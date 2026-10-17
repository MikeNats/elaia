import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type Settings } from '@/app';
import { createStore } from '@/store';
import type { ToWebview } from '@/shared';
import { FAKE_GLAFKA, fakeGlafkaDir } from '../../support/fakeGlafka';
import { FAKE_CLAUDE, fakeClaude } from '../../support/fakeClaude';
import { makeTicket } from '../../support/ticket';

let project: string;
let posted: ToWebview[];
let notified: string[];
let fake: ReturnType<typeof fakeGlafkaDir>;
let settings: Settings;
let leader: boolean;
let clock: string;

function app() {
  // Each app keeps the lists of its own test: a background refresh may outlive its test.
  const myPosts = posted;
  const myNotes = notified;
  return createApp({
    store: createStore(mkdtempSync(path.join(tmpdir(), 'elaia-app-store-'))),
    settings: () => settings,
    post: (m) => myPosts.push(m),
    notify: (text) => myNotes.push(text),
    isLeader: () => leader,
    now: () => clock,
  });
}

const lastSnapshot = () => posted.filter((m) => m.type === 'snapshot').at(-1);
// What you see in a thread: shown entries only.
const threadTexts = (a: ReturnType<typeof app>, thread: string) =>
  a.store.threads
    .read({ project, thread })
    .filter((e) => e.shown)
    .map((e) => e.text);

beforeEach(() => {
  clock = '2026-10-13T10:00:00Z';
  project = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-app-project-')));
  mkdirSync(path.join(project, '.glafka'));
  posted = [];
  notified = [];
  leader = true;
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

describe('app', { timeout: 30_000 }, () => {
  it('adds a project, lists its tickets and opens each ticket thread', async () => {
    const a = app();
    await a.addProject(project);
    const snap = lastSnapshot();
    expect(snap?.type === 'snapshot' && snap.snapshot.projects[0]?.tickets[0]?.id).toBe(
      '2026-10-13-add-csv-export',
    );
    expect(threadTexts(a, '2026-10-13-add-csv-export')).toEqual(['Ticket found — planned']);
  });

  it('asks before installing glafka, then installs it on Set up', async () => {
    const bare = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-bare-')));
    fake.answer('install', {});
    const a = app();
    await a.addProject(bare);
    expect(fake.calls().some((c) => c.includes('\tinstall'))).toBe(false);
    const card = a.store.threads.read({ project: bare, thread: 'project' }).at(-1);
    expect(card?.text).toContain('❌ glafka installed');
    expect(card?.actions?.map((x) => x.kind)).toEqual(['setup', 'skip-setup']);

    fakeClaude('turn');
    await a.setup(bare);
    expect(fake.calls().some((c) => c.startsWith(`${bare}\tinstall claude`))).toBe(true);
  });

  it('tells you when a ticket needs you', async () => {
    const a = app();
    await a.addProject(project);
    fake.answer('poreia', {
      contract: 1,
      tickets: [makeTicket({ summary: { rank: 0, text: 'x  ⚠ needs you  — checks failed' } })],
    });
    await a.refresh(project);
    expect(notified).toEqual(['2026-10-13-add-csv-export: Needs you: checks failed']);
  });

  it('notices a finished run by its exit code, shows its summary, and lets glafka go on', async () => {
    const a = app();
    await a.addProject(project);
    const run = path.join(
      project,
      '.glafka',
      'tickets',
      '2026-10-13-add-csv-export',
      'runs',
      'coder',
    );
    mkdirSync(run, { recursive: true });
    writeFileSync(path.join(run, 'log'), '{"type":"result","result":"All tasks done."}\n');
    writeFileSync(path.join(run, 'exit-code'), '0');
    writeFileSync(path.join(run, 'started-at'), '1700000000000');
    fake.answer('vima', {
      contract: 1,
      results: [{ id: '2026-10-13-add-csv-export', action: 'spawned-reviewer' }],
    });
    await a.refresh(project);
    // A short line you see; the run's own report behind "Show details".
    const entries = a.store.threads.read({ project, thread: '2026-10-13-add-csv-export' });
    expect(entries).toContainEqual(
      expect.objectContaining({ text: 'Coder finished.', shown: true }),
    );
    expect(entries).toContainEqual(
      expect.objectContaining({ text: 'All tasks done.', shown: false }),
    );
    await vi.waitFor(() =>
      expect(threadTexts(a, '2026-10-13-add-csv-export')).toContain('Review started.'),
    );
  });

  it('keeps a failed run as a finding', async () => {
    const a = app();
    await a.addProject(project);
    const run = path.join(
      project,
      '.glafka',
      'tickets',
      '2026-10-13-add-csv-export',
      'runs',
      'coder',
    );
    mkdirSync(run, { recursive: true });
    writeFileSync(path.join(run, 'log'), 'crashed early\n');
    writeFileSync(path.join(run, 'exit-code'), '1');
    await a.refresh(project);
    const entries = a.store.threads.read({ project, thread: '2026-10-13-add-csv-export' });
    expect(entries).toContainEqual(
      expect.objectContaining({ kind: 'finding', text: 'Coder stopped with an error (exit 1).' }),
    );
  });

  it('does not ring for old tickets on the first look, but still shows them', async () => {
    fake.answer('poreia', {
      contract: 1,
      tickets: [makeTicket({ summary: { rank: 0, text: 'x  ⚠ needs you  — checks failed' } })],
    });
    const a = app();
    await a.addProject(project);
    expect(notified).toEqual([]);
    expect(threadTexts(a, '2026-10-13-add-csv-export')).toContain('Needs you: checks failed');
  });

  it('only shows state in a second window, and writes nothing', async () => {
    leader = false;
    const a = app();
    await a.addProject(project);
    const snap = lastSnapshot();
    expect(snap?.type === 'snapshot' && snap.snapshot.projects[0]?.tickets).toHaveLength(1);
    expect(a.store.threads.read({ project, thread: '2026-10-13-add-csv-export' })).toEqual([]);
  });

  it("writes the shown thread into the repo's .elaia/ (ignored by git) when the ticket closes", async () => {
    const a = app();
    await a.addProject(project);
    fake.answer('poreia', { contract: 1, tickets: [] });
    await a.refresh(project);
    expect(readFileSync(path.join(project, '.elaia', '.gitignore'), 'utf8')).toContain('*');
    const file = path.join(project, '.elaia', 'chats', '2026-10-13-add-csv-export.jsonl');
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('Ticket found');
  });

  it('chats in the project folder and keeps the session', async () => {
    const claude = fakeClaude('turn');
    const a = app();
    await a.addProject(project);
    await a.send({ project, thread: 'project' }, 'hello');
    expect(claude.calls()[0]?.cwd).toBe(project);
    expect(threadTexts(a, 'project').slice(-2)).toEqual(['hello', 'It says hello from file "a".']);
  });

  it('chats in the worktree once it exists, with the ticket as context', async () => {
    const claude = fakeClaude('turn');
    const worktree = path.join(project, '.worktrees', 'x');
    mkdirSync(worktree, { recursive: true });
    fake.answer('poreia', {
      contract: 1,
      tickets: [makeTicket({ worktree, coder: { state: 'running' } })],
    });
    const a = app();
    await a.addProject(project);
    await a.send({ project, thread: '2026-10-13-add-csv-export' }, 'how far?');
    const [call] = claude.calls();
    expect(call?.cwd).toBe(worktree);
    expect(call?.stdin).toContain('glafka ticket 2026-10-13-add-csv-export');
    expect(call?.args.join(' ')).toContain(
      '--disallowedTools AskUserQuestion,Edit,Write,NotebookEdit',
    );
  });

  it('starts a fresh session with the thread when the saved one is gone', async () => {
    const claude = fakeClaude('turn');
    claude.resumeFails();
    const a = app();
    await a.addProject(project);
    const ref = { project, thread: 'project' };
    a.store.threads.append(ref, [
      { at: 'x', kind: 'agent', text: 'Earlier answer.', shown: true, source: 'chat' },
    ]);
    a.store.sessions.set(ref, project, 'cleaned-away');
    await a.send(ref, 'hello again');
    const calls = claude.calls();
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args.join(' ')).toContain('--resume cleaned-away');
    expect(calls[1]?.args).not.toContain('--resume');
    expect(calls[1]?.stdin).toContain('[Agent] Earlier answer.');
    expect(calls[1]?.stdin.match(/hello again/g)).toHaveLength(1);
    expect(threadTexts(a, 'project').filter((t) => t === 'hello again')).toHaveLength(1);
    expect(threadTexts(a, 'project')).toContain('It says hello from file "a".');
  });

  it('keeps edits blocked while the coder works', async () => {
    const claude = fakeClaude('turn');
    fake.answer('poreia', { contract: 1, tickets: [makeTicket({ coder: { state: 'running' } })] });
    const a = app();
    await a.addProject(project);
    const ref = { project, thread: '2026-10-13-add-csv-export' };
    a.store.sessions.allow(ref, 'Bash(rm:*)');
    await a.allow(ref, 'Write');
    expect(threadTexts(a, ref.thread).at(-1)).toContain('Edits stay blocked');
    await a.send(ref, 'status?');
    expect(claude.calls()[0]?.args.join(' ')).not.toContain('Bash(rm:*)');

    settings = { ...settings, agent: 'command', agentCommand: 'cat' };
    await a.send(ref, 'and now?');
    expect(threadTexts(a, ref.thread).at(-1)).toContain('waits until the coder finishes');
  });

  // A ticket the main chat could have made: open, no spec, nothing said in its own chat.
  const newIdea = (created?: string) =>
    makeTicket({
      id: '2026-10-13-new-idea',
      title: 'new idea',
      position: 'brainstorming',
      planned: false,
      specPath: null,
      planPath: null,
      ...(created ? { created } : {}),
    });
  const handedOff = '"new idea" goes on in its own chat: its questions, spec and plan come there.';

  it('plans a ticket made during a main-chat turn in its own chat', async () => {
    fakeClaude('turn');
    const a = app();
    await a.addProject(project);
    fake.answer('poreia', { contract: 1, tickets: [newIdea('2026-10-13T10:00:05Z')] });
    await a.send({ project, thread: 'project' }, 'add a new idea');
    expect(threadTexts(a, 'project')).toContain(handedOff);
    expect(threadTexts(a, '2026-10-13-new-idea')).toContain('Plan this ticket with me');
    // Wait for the planning turn's answer, so it does not run on into the next test.
    await vi.waitFor(() =>
      expect(threadTexts(a, '2026-10-13-new-idea')).toContain('It says hello from file "a".'),
    );
  });

  it('leaves a ticket made before the main-chat turn where it is', async () => {
    fakeClaude('turn');
    fake.answer('poreia', { contract: 1, tickets: [newIdea('2026-10-13T09:00:00Z')] });
    const a = app();
    await a.addProject(project);
    await a.send({ project, thread: 'project' }, 'hi');
    expect(threadTexts(a, 'project')).not.toContain(handedOff);
    expect(posted).not.toContainEqual({
      type: 'focus',
      ref: { project, thread: '2026-10-13-new-idea' },
    });
  });

  it('leaves a ticket with no created time where it is', async () => {
    fakeClaude('turn');
    const a = app();
    await a.addProject(project);
    fake.answer('poreia', { contract: 1, tickets: [newIdea()] });
    await a.send({ project, thread: 'project' }, 'hi');
    expect(threadTexts(a, 'project')).not.toContain(handedOff);
  });
});
