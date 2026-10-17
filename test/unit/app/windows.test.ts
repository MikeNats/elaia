import { mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, type Settings } from '@/app';
import { createStore } from '@/store';
import { threadKey, type ThreadRef, type ToWebview } from '@/shared';
import { FAKE_GLAFKA, fakeGlafkaDir } from '../../support/fakeGlafka';
import { FAKE_CLAUDE, fakeClaude } from '../../support/fakeClaude';
import { makeTicket } from '../../support/ticket';

// Two VS Code windows on one shared store: A leads, B does not.

const T = '2026-10-13-add-csv-export';
let project: string;
let root: string;
let fake: ReturnType<typeof fakeGlafkaDir>;
let settings: Settings;

// One window: its own app and its own posts, on the store every window shares.
function windowOn(leads: boolean) {
  const posts: ToWebview[] = [];
  const app = createApp({
    store: createStore(root),
    settings: () => settings,
    post: (m) => posts.push(m),
    notify: () => undefined,
    isLeader: () => leads,
    now: () => '2026-10-13T10:00:00Z',
  });
  return { app, posts };
}
type Window = ReturnType<typeof windowOn>;

const ref = (): ThreadRef => ({ project, thread: T });
// A thread file as the store watcher names it: relative to the store root.
const storePath = (w: Window, r: ThreadRef = ref()) =>
  path.relative(root, w.app.store.threads.file(r));
const threadPosts = (posts: ToWebview[]) =>
  posts.filter((m) => m.type === 'thread' && m.ref.thread === T);
// The tree's dots in the last snapshot a window posted; null when it posted none.
const lastDots = (posts: ToWebview[]) => {
  const snap = posts.filter((m) => m.type === 'snapshot').at(-1);
  return snap?.type === 'snapshot' ? (snap.snapshot.attention ?? {}) : null;
};

// The leader sees a new commit on T and writes one line about it.
async function leaderWritesALine(a: Window) {
  fake.answer('poreia', { contract: 1, tickets: [makeTicket({ steps: ['add the button'] })] });
  await a.app.refresh(project);
}

// A tracks the project first ("Ticket found — planned" in T); then B starts on the same store.
async function twoWindows() {
  const a = windowOn(true);
  await a.app.addProject(project);
  const b = windowOn(false);
  b.app.load();
  return { a, b };
}

beforeEach(() => {
  project = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-windows-project-')));
  mkdirSync(path.join(project, '.glafka'));
  root = mkdtempSync(path.join(tmpdir(), 'elaia-shared-store-'));
  fake = fakeGlafkaDir();
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

describe('two windows on one store', { timeout: 30_000 }, () => {
  it('shows a line the leader wrote in a thread open in the other window (AC-1)', async () => {
    const { a, b } = await twoWindows();
    b.app.openThread(ref());
    await leaderWritesALine(a);
    b.posts.length = 0;
    b.app.storeChanged([storePath(b)]);
    const [post] = threadPosts(b.posts);
    expect(post?.type === 'thread' && post.entries.map((e) => e.text)).toContain(
      'Commit: add the button',
    );
  });

  it('puts a dot on that thread in the other window (AC-2)', async () => {
    const { a, b } = await twoWindows();
    b.app.openThread(ref());
    await leaderWritesALine(a);
    b.app.storeChanged([storePath(b)]);
    expect(lastDots(b.posts)?.[threadKey(ref())]).toBe('new');
  });

  it('writes nothing to the thread files when it shows them (AC-3)', async () => {
    const { a, b } = await twoWindows();
    b.app.openThread(ref());
    await leaderWritesALine(a);
    const file = b.app.store.threads.file(ref());
    const before = readFileSync(file, 'utf8');
    const filesBefore = readdirSync(path.dirname(file));
    b.app.storeChanged([storePath(b)]);
    expect(readFileSync(file, 'utf8')).toBe(before);
    expect(readdirSync(path.dirname(file))).toEqual(filesBefore);
  });

  it("shows a chat line from the other window in the leader's open thread (AC-5)", async () => {
    fakeClaude('turn');
    const { a, b } = await twoWindows();
    a.app.openThread(ref());
    await b.app.send(ref(), 'hello');
    a.posts.length = 0;
    a.app.storeChanged([storePath(a)]);
    const [post] = threadPosts(a.posts);
    expect(post?.type === 'thread' && post.entries.map((e) => e.text)).toContain('hello');
  });

  it('does not post a thread again for lines it wrote itself (AC-6)', async () => {
    const { a } = await twoWindows();
    a.app.openThread(ref());
    await leaderWritesALine(a);
    a.posts.length = 0;
    a.app.storeChanged([storePath(a)]);
    expect(threadPosts(a.posts)).toEqual([]);
  });

  it('does not post the lines a window read when it started', async () => {
    const { b } = await twoWindows();
    b.app.openThread(ref());
    b.posts.length = 0;
    b.app.storeChanged([storePath(b)]);
    expect(b.posts).toEqual([]);
  });

  it('shows no dot when you are at the bottom of that thread (AC-7)', async () => {
    const { a, b } = await twoWindows();
    b.app.openThread(ref());
    b.app.viewing(ref(), true);
    await leaderWritesALine(a);
    b.app.storeChanged([storePath(b)]);
    b.app.snapshot();
    expect(lastDots(b.posts)).not.toBeNull();
    expect(lastDots(b.posts)?.[threadKey(ref())]).toBeUndefined();
  });

  it('ignores a thread file of a project it does not have (AC-9)', async () => {
    const { b } = await twoWindows();
    const other = { project: '/repos/not-here', thread: T };
    b.app.store.threads.append(other, [
      { at: '2026-10-13T10:00:00Z', kind: 'agent', text: 'x', shown: true, source: 'chat' },
    ]);
    b.posts.length = 0;
    b.app.storeChanged([storePath(b, other)]);
    // No thread and no snapshot: a dot for an unknown thread would post one.
    expect(b.posts).toEqual([]);
  });
});
