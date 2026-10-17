import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
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
