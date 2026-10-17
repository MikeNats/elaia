import { existsSync, mkdtempSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type App, type Settings } from '@/app';
import { handleMessage, type MessageContext } from '@/host/messages';
import type { ToWebview } from '@/shared';
import { createStore } from '@/store';
import { FAKE_CLAUDE } from '../../support/fakeClaude';
import { FAKE_GLAFKA } from '../../support/fakeGlafka';
import { makeTicket } from '../../support/ticket';

// VS Code itself, faked: the host only needs to open a folder here.
const { executeCommand } = vi.hoisted(() => ({ executeCommand: vi.fn() }));
vi.mock('vscode', () => ({
  commands: { executeCommand },
  Uri: { file: (fsPath: string) => ({ fsPath }) },
}));

const settings: Settings = {
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

const newDir = (prefix: string) => realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
const file = { name: 'notes.md', data: Buffer.from('# notes\n').toString('base64') };

// `project` is added to Elaia; `stranger` is a real folder Elaia does not know.
let project: string;
let stranger: string;
let app: App;
let posted: ToWebview[];
let ctx: MessageContext;
const errors = () => posted.flatMap((m) => (m.type === 'error' ? [m.text] : []));

beforeEach(() => {
  project = newDir('elaia-msg-project-');
  stranger = newDir('elaia-msg-stranger-');
  const store = createStore(newDir('elaia-msg-store-'));
  store.projects.add(project);
  app = createApp({
    store,
    settings: () => settings,
    post: () => {},
    notify: () => {},
    isLeader: () => true,
    now: () => '2026-10-17T10:00:00Z',
  });
  posted = [];
  ctx = {
    app,
    post: (m) => {
      posted.push(m);
    },
    projectsChanged: vi.fn(),
    ready: vi.fn(),
    showChat: vi.fn(),
    focusThread: vi.fn(),
    opened: vi.fn(),
    ownWindow: vi.fn(async () => {}),
  };
  executeCommand.mockClear();
});

describe('handleMessage: the project', () => {
  it('refuses drop-files for a project Elaia does not know, and writes no file', async () => {
    const save = vi.spyOn(app, 'saveInbox');
    await handleMessage({ type: 'drop-files', project: stranger, files: [file] }, ctx);
    expect(errors()).toEqual([`Elaia does not know the project ${stranger}.`]);
    expect(save).not.toHaveBeenCalled();
    expect(readdirSync(stranger)).toEqual([]);
  });

  it('refuses approve-epic for a project Elaia does not know', async () => {
    const approve = vi.spyOn(app, 'approveEpic');
    const msg = {
      type: 'approve-epic',
      project: stranger,
      epic: 'publish-polish',
      approval: 'epic',
    };
    await handleMessage(msg, ctx);
    expect(errors()).toEqual([`Elaia does not know the project ${stranger}.`]);
    expect(approve).not.toHaveBeenCalled();
    expect(readdirSync(stranger)).toEqual([]);
    expect(app.store.threads.list(stranger)).toEqual([]);
  });

  it('lets a known project through', async () => {
    await handleMessage({ type: 'drop-files', project, files: [file] }, ctx);
    expect(errors()).toEqual([]);
    expect(existsSync(path.join(project, 'docs', 'elaia', 'inbox', 'notes.md'))).toBe(true);
  });
});

describe('handleMessage: names', () => {
  it('refuses epic ../../y and writes no file', async () => {
    const approve = vi.spyOn(app, 'approveEpic');
    await handleMessage({ type: 'approve-epic', project, epic: '../../y', approval: 'epic' }, ctx);
    expect(errors()).toHaveLength(1);
    expect(errors()[0]).toContain('Elaia got a message it does not understand');
    expect(approve).not.toHaveBeenCalled();
    expect(readdirSync(project)).toEqual([]);
  });

  it('refuses ticket --force and runs nothing', async () => {
    const advance = vi.spyOn(app, 'advance');
    await handleMessage({ type: 'advance', project, ticket: '--force' }, ctx);
    expect(errors()).toHaveLength(1);
    expect(errors()[0]).toContain('does not understand');
    expect(advance).not.toHaveBeenCalled();
  });

  it('refuses thread epic-../../y and starts no agent', async () => {
    const send = vi.spyOn(app, 'send');
    await handleMessage({ type: 'send', project, thread: 'epic-../../y', text: 'hi' }, ctx);
    expect(errors()).toHaveLength(1);
    expect(errors()[0]).toContain('does not understand');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('handleMessage: open-folder', () => {
  const id = '2026-10-13-add-csv-export';

  it('opens the worktree of the ticket it names', async () => {
    vi.spyOn(app, 'ticket').mockReturnValue(makeTicket({ worktree: '/wt/csv' }));
    await handleMessage({ type: 'open-folder', project, ticket: id }, ctx);
    expect(errors()).toEqual([]);
    expect(executeCommand).toHaveBeenCalledWith(
      'vscode.openFolder',
      { fsPath: '/wt/csv' },
      { forceNewWindow: true },
    );
  });

  it('says so when the ticket has no worktree', async () => {
    vi.spyOn(app, 'ticket').mockReturnValue(makeTicket({ worktree: null }));
    await handleMessage({ type: 'open-folder', project, ticket: id }, ctx);
    expect(errors()).toEqual([`Ticket ${id} has no worktree yet.`]);
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it('takes no path, and open-file is gone', async () => {
    await handleMessage({ type: 'open-folder', path: '/etc' }, ctx);
    await handleMessage({ type: 'open-file', path: '/etc/passwd' }, ctx);
    expect(errors()).toHaveLength(2);
    expect(errors().every((t) => t.includes('does not understand'))).toBe(true);
    expect(executeCommand).not.toHaveBeenCalled();
  });
});
