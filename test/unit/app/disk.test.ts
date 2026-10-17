import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, type Settings } from '@/app';
import { save } from '@/app/handoffNote';
import type { AppState } from '@/app/types';
import { createStore } from '@/store';
import { threadKey, type ToWebview } from '@/shared';
import { FAKE_GLAFKA, fakeGlafkaDir } from '../../support/fakeGlafka';
import { FAKE_CLAUDE, fakeClaude } from '../../support/fakeClaude';
import { makeTicket } from '../../support/ticket';

const NOW = '2026-10-13T10:00:00Z';
let project: string;
let storeRoot: string;
let posted: ToWebview[];
let settings: Settings;
let leader: boolean;

function app() {
  const myPosts = posted;
  return createApp({
    store: createStore(storeRoot),
    settings: () => settings,
    post: (m) => myPosts.push(m),
    notify: () => undefined,
    isLeader: () => leader,
    now: () => NOW,
  });
}

const threadTexts = (a: ReturnType<typeof app>, thread: string) =>
  a.store.threads
    .read({ project, thread })
    .filter((e) => e.shown)
    .map((e) => e.text);
// keepSoon writes the chat into .elaia/ 1.5 s after its last line.
const afterKeepSoon = () => new Promise((resolve) => setTimeout(resolve, 1_700));
const elsewhere = () => realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-elsewhere-')));

beforeEach(() => {
  project = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-disk-project-')));
  storeRoot = mkdtempSync(path.join(tmpdir(), 'elaia-disk-store-'));
  mkdirSync(path.join(project, '.glafka'));
  posted = [];
  leader = true;
  const fake = fakeGlafkaDir();
  fake.answer('poreia', { contract: 1, tickets: [makeTicket()] });
  fake.answer('audit', { schema: 3, tickets: [], byRole: [] });
  settings = {
    workflow: 'glafka',
    glafkaPath: FAKE_GLAFKA,
    platform: 'claude',
    agent: 'claude',
    claudePath: FAKE_CLAUDE,
    agentCommand: '',
    permissionMode: 'acceptEdits',
    allowedTools: ['Bash(glafka:*)'],
    autoAdvance: true,
  };
});

describe('a deleted project folder', { timeout: 30_000 }, () => {
  it('is never made again, so no agent ever starts in it', async () => {
    const claude = fakeClaude('turn');
    const a = app();
    await a.addProject(project);
    rmSync(project, { recursive: true, force: true });
    const ref = { project, thread: 'project' };
    await a.send(ref, 'hello');
    await afterKeepSoon();
    await a.send(ref, 'hello again');
    a.dispose();
    expect(existsSync(project)).toBe(false);
    expect(claude.calls()).toEqual([]);
    const missing = `The folder ${project} does not exist. Was the project moved? Remove it from Elaia and add it again.`;
    expect(threadTexts(a, 'project').filter((t) => t === missing)).toHaveLength(2);
  });

  it('gets no handoff note, and the save says why', () => {
    rmSync(project, { recursive: true, force: true });
    const state = { deps: { now: () => NOW } } as unknown as AppState;
    expect(() => save(state, { project, thread: 'project' }, 'note', 'about')).toThrow(
      `The project folder is missing: ${project}`,
    );
    expect(existsSync(project)).toBe(false);
  });

  it('gets no dropped file, and the main chat says why', async () => {
    const a = app();
    await a.addProject(project);
    rmSync(project, { recursive: true, force: true });
    a.saveInbox(project, [{ name: 'notes.txt', data: Buffer.from('hi').toString('base64') }]);
    a.dispose();
    expect(existsSync(project)).toBe(false);
    expect(threadTexts(a, 'project').at(-1)).toBe(`The project folder is missing: ${project}`);
  });
});

describe('the .elaia folder', { timeout: 30_000 }, () => {
  it('replaces a .gitignore that is only a comment, so git ignores the chat', async () => {
    fakeClaude('turn');
    execFileSync('git', ['init', '-q'], { cwd: project });
    mkdirSync(path.join(project, '.elaia'));
    writeFileSync(path.join(project, '.elaia', '.gitignore'), '# just a comment\n');
    const a = app();
    await a.addProject(project);
    await a.send({ project, thread: 'project' }, 'hello');
    a.dispose();
    const chat = path.join('.elaia', 'chats', 'project.jsonl');
    expect(existsSync(path.join(project, chat))).toBe(true);
    // Exit code 0 means ignored; 1 (not ignored) throws.
    expect(() => execFileSync('git', ['check-ignore', '-q', chat], { cwd: project })).not.toThrow();
  });

  it('writes no chat through a symlinked .elaia', async () => {
    fakeClaude('turn');
    const target = elsewhere();
    symlinkSync(target, path.join(project, '.elaia'));
    const a = app();
    await a.addProject(project);
    await a.send({ project, thread: 'project' }, 'hello');
    a.dispose();
    expect(readdirSync(target)).toEqual([]);
  });

  it('writes no chat through a symlinked .elaia/chats', async () => {
    fakeClaude('turn');
    const target = elsewhere();
    mkdirSync(path.join(project, '.elaia'));
    symlinkSync(target, path.join(project, '.elaia', 'chats'));
    const a = app();
    await a.addProject(project);
    await a.send({ project, thread: 'project' }, 'hello');
    a.dispose();
    expect(readdirSync(target)).toEqual([]);
  });

  it('says why a handoff note could not be saved, and writes none through a symlink', async () => {
    fakeClaude('turn');
    // Any context use is over the line, so this turn hands over.
    settings = { ...settings, handoffAt: 1 };
    const target = elsewhere();
    mkdirSync(path.join(project, '.elaia'));
    symlinkSync(target, path.join(project, '.elaia', 'handoffs'));
    const a = app();
    await a.addProject(project);
    await a.send({ project, thread: 'project' }, 'hello');
    const link = path.join(project, '.elaia', 'handoffs');
    expect(threadTexts(a, 'project')).toContain(
      `The handoff note could not be saved: ${link} is a symlink. Elaia writes nothing there.`,
    );
    expect(readdirSync(target)).toEqual([]);
  });
});

describe('a chat lock', { timeout: 30_000 }, () => {
  // A lock as another window leaves it: a pid that runs, but is not this one.
  const leaveLock = (key: string, at: number) => {
    const dir = path.join(storeRoot, 'locks');
    mkdirSync(dir, { recursive: true });
    const name = `${createHash('sha1').update(key).digest('hex')}.json`;
    writeFileSync(path.join(dir, name), JSON.stringify({ pid: process.ppid, at }));
  };

  it('keeps the chat for the window that holds a fresh lock', async () => {
    const claude = fakeClaude('turn');
    const a = app();
    await a.addProject(project);
    const ref = { project, thread: 'project' };
    leaveLock(threadKey(ref), Date.now());
    await a.send(ref, 'hello');
    expect(claude.calls()).toEqual([]);
    expect(threadTexts(a, 'project').at(-1)).toBe(
      'This chat is answering in another VS Code window. Wait for it there.',
    );
  });

  it('frees the chat when the lock is old, though its pid runs something else now', async () => {
    const claude = fakeClaude('turn');
    const a = app();
    await a.addProject(project);
    const ref = { project, thread: 'project' };
    leaveLock(threadKey(ref), Date.now() - 200_000);
    await a.send(ref, 'hello');
    expect(claude.calls()).toHaveLength(1);
  });
});
