import { mkdirSync, mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type App, type Settings } from '@/app';
import { afterTurn } from '@/app/setup';
import { createStore } from '@/store';
import { PROJECT_THREAD, threadKey, type ThreadRef, type ToWebview } from '@/shared';
import { FAKE_GLAFKA, fakeGlafkaDir } from '../../support/fakeGlafka';
import { FAKE_CLAUDE, fakeClaude } from '../../support/fakeClaude';
import { makeTicket } from '../../support/ticket';

// afterTurn runs for real unless a test makes one call fail.
vi.mock('@/app/setup', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/app/setup')>();
  return { ...real, afterTurn: vi.fn(real.afterTurn) };
});

const TICKET = '2026-10-13-add-csv-export';
const ANOTHER_WINDOW = 'This chat is answering in another VS Code window. Wait for it there.';
let project: string;
let posted: ToWebview[];
let settings: Settings;
let fake: ReturnType<typeof fakeGlafkaDir>;
let claude: ReturnType<typeof fakeClaude>;

function app() {
  const myPosts = posted;
  return createApp({
    store: createStore(mkdtempSync(path.join(tmpdir(), 'elaia-failed-store-'))),
    settings: () => settings,
    post: (m) => myPosts.push(m),
    notify: () => undefined,
    isLeader: () => true,
    now: () => '2026-10-13T10:00:00Z',
  });
}

const lastSnapshot = () => {
  const m = posted.filter((p) => p.type === 'snapshot').at(-1);
  return m?.type === 'snapshot' ? m.snapshot : null;
};
const entries = (a: App, ref: ThreadRef) => a.store.threads.read(ref);
const texts = (a: App, ref: ThreadRef, kind: string) =>
  entries(a, ref)
    .filter((e) => e.kind === kind)
    .map((e) => e.text);

// Sends "hello" and waits until its slow agent runs, so the next message has to wait.
async function startBusy(a: App, ref: ThreadRef): Promise<{ done: Promise<void> }> {
  const done = a.send(ref, 'hello');
  await vi.waitFor(
    () => {
      expect(lastSnapshot()?.busy).toContain(threadKey(ref));
      expect(claude.calls().length).toBeGreaterThan(0);
    },
    { timeout: 3_000 },
  );
  return { done };
}

beforeEach(() => {
  project = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-failed-project-')));
  mkdirSync(path.join(project, '.glafka'));
  posted = [];
  fake = fakeGlafkaDir();
  fake.answer('poreia', { contract: 1, tickets: [makeTicket()] });
  fake.answer('audit', { schema: 3, tickets: [], byRole: [] });
  claude = fakeClaude('turn');
  claude.slow(400);
  vi.mocked(afterTurn).mockReset();
  settings = {
    workflow: 'glafka',
    glafkaPath: FAKE_GLAFKA,
    platform: 'claude',
    agent: 'claude',
    claudePath: FAKE_CLAUDE,
    agentCommand: '',
    permissionMode: 'acceptEdits',
    allowedTools: ['Bash(glafka:*)'],
    autoAdvance: false,
  };
});

describe('the chat queue', { timeout: 15_000 }, () => {
  it('runs the next waiting message when afterTurn fails, and the queue ends empty', async () => {
    const a = app();
    await a.addProject(project);
    const ref = { project, thread: TICKET };
    vi.mocked(afterTurn).mockRejectedValueOnce(new Error('boom: the run file is gone'));
    const { done } = await startBusy(a, ref);
    await a.send(ref, 'second');
    expect(lastSnapshot()?.queued?.[threadKey(ref)]).toBe(1);
    await done;
    expect(claude.calls()).toHaveLength(2);
    expect(texts(a, ref, 'error')).toContain('boom: the run file is gone');
    expect(lastSnapshot()?.queued).toEqual({});
  });

  it('moves the queue on when another window holds the chat', async () => {
    const a = app();
    await a.addProject(project);
    const ref = { project, thread: TICKET };
    const { done } = await startBusy(a, ref);
    await a.send(ref, 'second');
    await a.send(ref, 'third');
    // From now on another VS Code window holds this chat.
    vi.spyOn(a.store.locks, 'take').mockReturnValue(false);
    await done;
    expect(texts(a, ref, 'error').filter((t) => t === ANOTHER_WINDOW)).toHaveLength(2);
    expect(claude.calls()).toHaveLength(1);
    expect(lastSnapshot()?.queued).toEqual({});
  });
});

describe('when VS Code closes', { timeout: 15_000 }, () => {
  it('drops a waiting message with a Not sent line and starts no agent', async () => {
    const a = app();
    await a.addProject(project);
    const ref = { project, thread: TICKET };
    const { done } = await startBusy(a, ref);
    await a.send(ref, 'second');
    a.dispose();
    await done;
    expect(claude.calls()).toHaveLength(1);
    expect(afterTurn).not.toHaveBeenCalled();
    expect(texts(a, ref, 'error')).toContain(
      'Not sent: Elaia closed before it ran. Send it again.',
    );
    expect(lastSnapshot()?.queued).toEqual({});
  });

  it('starts no agent for a message or a button after dispose', async () => {
    const a = app();
    await a.addProject(project);
    const ref = { project, thread: TICKET };
    a.dispose();
    await a.send(ref, 'too late');
    await a.push(ref);
    expect(claude.calls()).toHaveLength(0);
    expect(texts(a, ref, 'you')).toEqual([]);
  });
});

describe('turns Elaia starts itself', { timeout: 15_000 }, () => {
  it('Explain in a busy main chat adds no empty You line', async () => {
    const a = app();
    await a.addProject(project);
    const main = { project, thread: PROJECT_THREAD };
    const { done } = await startBusy(a, main);
    await a.setupStep(project, 'map', 'explain');
    expect(lastSnapshot()?.queued?.[threadKey(main)]).toBe(1);
    expect(texts(a, main, 'you')).toEqual(['hello', 'Explain']);
    await done;
  });

  it('a stop explained while the ticket chat is busy keeps the waiting dot', async () => {
    const a = app();
    await a.addProject(project);
    const ref = { project, thread: TICKET };
    const { done } = await startBusy(a, ref);
    fake.answer('poreia', {
      contract: 1,
      tickets: [makeTicket({ summary: { rank: 0, text: 'x  ⚠ needs you  — checks failed' } })],
    });
    await a.refresh(project);
    expect(lastSnapshot()?.queued?.[threadKey(ref)]).toBe(1);
    expect(lastSnapshot()?.attention?.[threadKey(ref)]).toBe('waiting');
    await done;
    expect(texts(a, ref, 'you')).toEqual(['hello']);
  });
});
