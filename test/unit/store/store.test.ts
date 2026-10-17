import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, type Store } from '@/store';
import type { ThreadEntry } from '@/shared';
import { makeTicket } from '../../support/ticket';

let root: string;
let store: Store;
const ref = { project: '/repos/frontline', thread: '2026-10-13-add-csv' };

function entry(text: string, shown = true): ThreadEntry {
  return { at: '2026-10-13T00:00:00Z', kind: 'agent', text, shown, source: 'chat' };
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'elaia-store-'));
  store = createStore(root);
});

describe('projects', () => {
  it('adds a project once, keeps it across restarts, and removes it', () => {
    store.projects.add('/repos/frontline');
    store.projects.add('/repos/frontline');
    expect(createStore(root).projects.list()).toEqual([
      { path: '/repos/frontline', name: 'frontline' },
    ]);
    store.projects.remove('/repos/frontline');
    expect(store.projects.list()).toEqual([]);
  });
});

describe('threads', () => {
  it('finds the thread of a changed store file, only for projects it is given', () => {
    const file = path.relative(root, store.threads.file(ref));
    expect(store.threads.refOf(file, ['/repos/other', ref.project])).toEqual(ref);
    expect(store.threads.refOf(file, ['/repos/other'])).toBeNull();
    expect(store.threads.refOf(`${file}.tmp`, [ref.project])).toBeNull();
    expect(store.threads.refOf('runs/x.log', [ref.project])).toBeNull();
    expect(store.threads.refOf('seen.json', [ref.project])).toBeNull();
  });

  it('appends and reads entries per thread', () => {
    store.threads.append(ref, [entry('one'), entry('two', false)]);
    store.threads.append({ ...ref, thread: 'project' }, [entry('other')]);
    expect(store.threads.read(ref).map((e) => e.text)).toEqual(['one', 'two']);
  });

  it('tail returns the last shown entries only', () => {
    store.threads.append(ref, [entry('a'), entry('hidden', false), entry('b'), entry('c')]);
    expect(store.threads.tail(ref, 2).map((e) => e.text)).toEqual(['b', 'c']);
  });

  it('skips a broken line instead of losing the whole thread', () => {
    store.threads.append(ref, [entry('kept')]);
    const file = store.threads.file(ref);
    writeFileSync(file, `${readFileSync(file, 'utf8')}{not json\n`);
    expect(store.threads.read(ref).map((e) => e.text)).toEqual(['kept']);
  });
});

describe('sessions', () => {
  it('keeps one session per folder, because a session cannot move folders', () => {
    expect(store.sessions.get(ref, '/repos/frontline')).toBeNull();
    store.sessions.set(ref, '/repos/frontline', 's1');
    store.sessions.set(ref, '/repos/frontline/.worktrees/x', 's2');
    expect(store.sessions.get(ref, '/repos/frontline')).toBe('s1');
    expect(store.sessions.get(ref, '/repos/frontline/.worktrees/x')).toBe('s2');
  });

  it('remembers allowed tools per thread, once each', () => {
    store.sessions.allow(ref, 'Write');
    store.sessions.allow(ref, 'Write');
    expect(store.sessions.allowed(ref)).toEqual(['Write']);
  });
});

describe('runs', () => {
  it('copies a finished run log once', () => {
    const src = path.join(root, 'log');
    writeFileSync(src, 'line\n');
    expect(store.runs.copy(ref, 'coder', '1700000000000', src)).toBe(true);
    expect(store.runs.copy(ref, 'coder', '1700000000000', src)).toBe(false);
  });
});

describe('views, tokens, published', () => {
  it('round-trips the last seen views and sums chat tokens', () => {
    store.views.write(ref.project, { a: makeTicket({ id: 'a' }) });
    expect(Object.keys(store.views.read(ref.project))).toEqual(['a']);
    const t = { in: 1, out: 2, cacheRead: 3, cacheWrite: 4, costUsd: 0.5 };
    store.tokens.add(ref, t);
    store.tokens.add(ref, t);
    expect(store.tokens.read(ref.project)[ref.thread]).toEqual({
      in: 2,
      out: 4,
      cacheRead: 6,
      cacheWrite: 8,
      costUsd: 1,
    });
  });

  it('marks a published thread', () => {
    expect(store.published.has(ref)).toBe(false);
    store.published.mark(ref);
    expect(store.published.has(ref)).toBe(true);
  });

  it('falls back to empty when a file is corrupt', () => {
    mkdirSync(root, { recursive: true });
    writeFileSync(path.join(root, 'projects.json'), '{broken');
    expect(createStore(root).projects.list()).toEqual([]);
  });
});

describe('locks', () => {
  const lockFile = (key: string) =>
    path.join(root, 'locks', `${createHash('sha1').update(key).digest('hex')}.json`);
  const leave = (key: string, lock: object) => {
    mkdirSync(path.join(root, 'locks'), { recursive: true });
    writeFileSync(lockFile(key), JSON.stringify(lock));
  };
  const readLock = (key: string) =>
    JSON.parse(readFileSync(lockFile(key), 'utf8')) as { pid: number; at: number };
  // A pid that runs, but is not this window: the process that started the tests.
  const other = process.ppid;

  afterEach(() => {
    vi.useRealTimers();
  });

  it('takes an old lock whose pid runs again: the pid was reused after a crash', () => {
    leave('k', { pid: other, at: Date.now() - 200_000 });
    expect(store.locks.take('k')).toBe(true);
  });

  it('keeps out a fresh lock held by a live window', () => {
    leave('k', { pid: other, at: Date.now() });
    expect(store.locks.take('k')).toBe(false);
  });

  it('takes a lock with no time, as an older Elaia wrote it', () => {
    leave('k', { pid: other });
    expect(store.locks.take('k')).toBe(true);
  });

  it('keeps its lock fresh while the turn runs, and stops once it lets go', () => {
    vi.useFakeTimers();
    expect(store.locks.take('k')).toBe(true);
    vi.advanceTimersByTime(160_000);
    const lock = readLock('k');
    expect(lock.pid).toBe(process.pid);
    expect(Date.now() - lock.at).toBeLessThanOrEqual(30_000);
    store.locks.release('k');
    expect(existsSync(lockFile('k'))).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never takes back a lock another window took meanwhile', () => {
    vi.useFakeTimers();
    store.locks.take('k');
    leave('k', { pid: other, at: Date.now() });
    vi.advanceTimersByTime(30_000);
    expect(readLock('k').pid).toBe(other);
    store.locks.release('k');
    expect(existsSync(lockFile('k'))).toBe(true);
  });
});

describe('usage', () => {
  const row = (at: string, cost: number) => ({
    at,
    project: '/repos/frontline',
    thread: 'project',
    cost,
    tokens: 10,
    source: 'chat' as const,
  });
  const file = () => path.join(root, 'usage.jsonl');

  it('drops the rows before the cutoff and keeps the rest', () => {
    store.usage.add(row('2026-10-01T00:00:00Z', 5));
    store.usage.add(row('2026-10-12T00:00:00Z', 2));
    store.usage.drop('2026-10-06T10:00:00Z');
    expect(store.usage.since('')).toEqual([row('2026-10-12T00:00:00Z', 2)]);
    expect(readFileSync(file(), 'utf8').trim().split('\n')).toHaveLength(1);
  });

  it('leaves the file alone when no row is old, or when there is no file', () => {
    store.usage.drop('2026-10-06T10:00:00Z');
    expect(existsSync(file())).toBe(false);
    store.usage.add(row('2026-10-12T00:00:00Z', 2));
    const before = statSync(file()).ino;
    store.usage.drop('2026-10-06T10:00:00Z');
    expect(statSync(file()).ino).toBe(before);
  });
});
