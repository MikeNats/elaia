import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTurns, contextPrompt } from '@/chat';
import { createStore, type Store } from '@/store';
import type { ThreadEntry, ThreadRef } from '@/shared';
import { FAKE_CLAUDE, fakeClaude } from '../../support/fakeClaude';

let store: Store;
let folder: string;
let emitted: ThreadEntry[];
const ref: ThreadRef = { project: '/repos/frontline', thread: '2026-10-13-x' };

const agent = {
  kind: 'claude' as const,
  bin: FAKE_CLAUDE,
  permissionMode: 'acceptEdits',
  allowedTools: ['Bash(glafka:*)'],
  readOnly: false,
};

function deps() {
  return {
    store,
    now: () => '2026-10-13T10:00:00Z',
    emit: (_: ThreadRef, e: ThreadEntry[]) => emitted.push(...e),
  };
}

beforeEach(() => {
  store = createStore(mkdtempSync(path.join(tmpdir(), 'elaia-chat-')));
  folder = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-folder-')));
  emitted = [];
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('chat turns', { timeout: 20_000 }, () => {
  it('shows your message and the answer, hides tool work, and keeps the session', async () => {
    const fake = fakeClaude('turn');
    const turns = createTurns();
    await turns.run(deps(), {
      ref,
      folder,
      text: 'what is in note.txt?',
      prompt: 'what is in note.txt?',
      agent,
    });

    expect(emitted.map((e) => [e.kind, e.shown])).toEqual([
      ['you', true],
      ['tool', false],
      ['tool-result', false],
      ['agent', true],
    ]);
    expect(store.threads.read(ref)).toHaveLength(4);
    expect(store.sessions.get(ref, folder)).toBe('1e0376de-5fc4-4e2e-afa9-cdf0da31174e');
    expect(store.tokens.read(ref.project)[ref.thread]?.cacheRead).toBe(27951);
    expect(readFileSync(path.join(store.runs.dir(ref), 'chat.log'), 'utf8')).toContain(
      '"type":"result"',
    );

    const [call] = fake.calls();
    expect(call?.cwd).toBe(folder);
    expect(call?.stdin).toBe('what is in note.txt?');
    expect(call?.args).not.toContain('--resume');
  });

  it('resumes the saved session on the next turn in the same folder', async () => {
    const fake = fakeClaude('turn');
    const turns = createTurns();
    store.sessions.set(ref, folder, 'saved-session');
    await turns.run(deps(), { ref, folder, text: 'again', prompt: 'again', agent });
    expect(fake.calls()[0]?.args.join(' ')).toContain('--resume saved-session');
  });

  it('hands your login to the agent, but not the nested marker', async () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'tok-123');
    vi.stubEnv('CLAUDECODE', '1');
    const fake = fakeClaude('turn');
    await createTurns().run(deps(), { ref, folder, text: 'hi', prompt: 'hi', agent });
    const env = fake.calls()[0]?.env;
    expect(env?.CLAUDE_CODE_OAUTH_TOKEN).toBe('tok-123');
    expect(env).not.toHaveProperty('CLAUDECODE');
  });

  it('turns a crash into an error entry', async () => {
    const fake = fakeClaude('turn');
    fake.fail();
    await createTurns().run(deps(), { ref, folder, text: 'hi', prompt: 'hi', agent });
    expect(emitted.at(-1)).toMatchObject({
      kind: 'error',
      text: expect.stringContaining('something broke'),
    });
  });

  it('says how to fix a missing agent command', async () => {
    fakeClaude('turn');
    const missing = { ...agent, bin: '/no/such/claude' };
    await createTurns().run(deps(), { ref, folder, text: 'hi', prompt: 'hi', agent: missing });
    expect(emitted.at(-1)).toMatchObject({
      kind: 'error',
      text: expect.stringContaining('elaia.claudePath'),
    });
  });

  it('runs one turn per thread at a time', async () => {
    fakeClaude('turn');
    const turns = createTurns();
    const first = turns.run(deps(), { ref, folder, text: 'a', prompt: 'a', agent });
    expect(turns.isBusy(ref)).toBe(true);
    await expect(turns.run(deps(), { ref, folder, text: 'b', prompt: 'b', agent })).rejects.toThrow(
      /still answering/,
    );
    await first;
    expect(turns.isBusy(ref)).toBe(false);
  });
});

describe('chat turns that go wrong', { timeout: 20_000 }, () => {
  it('drops a saved session that can no longer be resumed, and says so', async () => {
    fakeClaude('resume-fail');
    store.sessions.set(ref, folder, 'gone-session');
    const result = await createTurns().run(deps(), {
      ref,
      folder,
      text: 'hi',
      prompt: 'hi',
      agent,
    });
    expect(result.resumeFailed).toBe(true);
    expect(store.sessions.get(ref, folder)).toBeNull();
    expect(emitted.map((e) => e.kind)).toEqual(['you']);
  });

  it('says the folder is gone instead of blaming the agent command', async () => {
    fakeClaude('turn');
    await createTurns().run(deps(), {
      ref,
      folder: '/no/such/folder',
      text: 'hi',
      prompt: 'hi',
      agent,
    });
    expect(emitted.at(-1)).toMatchObject({
      kind: 'error',
      text: expect.stringContaining('does not exist'),
    });
  });

  it('stops the whole command, child processes too', async () => {
    const turns = createTurns();
    const shell = { kind: 'command' as const, command: 'sleep 30 | cat' };
    const running = turns.run(deps(), { ref, folder, text: 'hi', prompt: 'hi', agent: shell });
    await vi.waitFor(() => expect(turns.isBusy(ref)).toBe(true));
    turns.stop(ref);
    await running;
    expect(turns.isBusy(ref)).toBe(false);
    expect(emitted.at(-1)).toMatchObject({ kind: 'progress', text: 'Stopped.' });
  });
});

describe('contextPrompt', () => {
  it('gives a fresh session the ticket, its files and the recent thread', () => {
    const prompt = contextPrompt({
      ticketId: 't1',
      title: 'add csv',
      specPath: 'docs/spec.md',
      planPath: 'docs/plan.md',
      folder: '/repo/.worktrees/t1',
      tail: [{ at: 'x', kind: 'agent', text: 'Plan approved.', shown: true, source: 'chat' }],
      text: 'how far is it?',
    });
    expect(prompt).toContain('glafka ticket t1 (add csv)');
    expect(prompt).toContain('Spec: docs/spec.md');
    expect(prompt).toContain('[Agent] Plan approved.');
    expect(prompt.trim().endsWith('My new message:\nhow far is it?')).toBe(true);
  });
});
