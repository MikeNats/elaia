import { mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp, type Settings } from '@/app';
import { EpicSchema, planHash, readEpic } from '@/epics';
import { epicThread } from '@/shared';
import { createStore } from '@/store';
import { FAKE_GLAFKA, fakeGlafkaDir } from '../../support/fakeGlafka';
import { FAKE_CLAUDE } from '../../support/fakeClaude';

let project: string;
let storeRoot: string;
let fake: ReturnType<typeof fakeGlafkaDir>;

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

// Two apps on the same store folder are Elaia before and after a restart.
const app = () =>
  createApp({
    store: createStore(storeRoot),
    settings: () => settings,
    post: () => {},
    notify: () => {},
    isLeader: () => true,
    now: () => '2026-10-13T10:00:00Z',
  });

// Writes the epic into the project and approves it as a whole, as the Approve button does.
function approvedEpic(json: object): void {
  const file = path.join(project, 'docs', 'elaia', 'epics', 'polish', 'epic.json');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(json));
  createStore(storeRoot).approvals.set(project, 'polish', {
    approval: 'epic',
    plan: planHash(EpicSchema.parse(json)),
    at: '2026-10-13T09:00:00Z',
  });
}

const epicLines = (a: ReturnType<typeof app>) =>
  a.store.threads.read({ project, thread: epicThread('polish') }).map((e) => e.text);

const B_AFTER_A = {
  title: 'Polish',
  tickets: [
    { key: 'a', title: 'Fix A', brief: 'a', ticketId: '2026-10-13-fix-a', state: 'cancelled' },
    { key: 'b', title: 'Fix B', brief: 'b', dependsOn: ['a'] },
  ],
};
const B_WAITS =
  '"Fix B" waits on "Fix A", which was cancelled. It does not start on its own: change the plan here to go on.';

beforeEach(() => {
  project = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-epic-project-')));
  storeRoot = mkdtempSync(path.join(tmpdir(), 'elaia-epic-store-'));
  mkdirSync(path.join(project, '.glafka'));
  // A coder is set, so the epic may run on its own.
  writeFileSync(
    path.join(project, '.glafka.json'),
    JSON.stringify({ agents: { coder: 'claude -p' } }),
  );
  fake = fakeGlafkaDir();
  fake.answer('poreia', { contract: 1, tickets: [] });
  fake.answer('audit', { schema: 3, tickets: [], byRole: [] });
});

describe('an epic ticket that waits on a cancelled one', { timeout: 30_000 }, () => {
  it('is named once in the epic chat over several refreshes, and is not started', async () => {
    approvedEpic(B_AFTER_A);
    const a = app();
    await a.addProject(project);
    await a.refresh(project);
    await a.refresh(project);
    expect(epicLines(a).filter((t) => t === B_WAITS)).toHaveLength(1);
    expect(readEpic(project, 'polish').epic?.tickets[1]).toMatchObject({
      state: 'waiting',
      ticketId: null,
    });
    expect(fake.calls().some((c) => c.includes('\tcreate'))).toBe(false);
  });

  it('is not named again after Elaia restarts on the same saved chats', async () => {
    approvedEpic(B_AFTER_A);
    const before = app();
    await before.addProject(project);
    const after = app();
    after.load();
    await after.refresh(project);
    expect(epicLines(after).filter((t) => t === B_WAITS)).toHaveLength(1);
  });

  it('in an ordered epic, names every ticket after the cancelled one in one line', async () => {
    approvedEpic({
      title: 'Polish',
      ordered: true,
      tickets: [
        { key: 'a', title: 'Fix A', brief: 'a', ticketId: '2026-10-13-fix-a', state: 'merged' },
        { key: 'b', title: 'Fix B', brief: 'b', ticketId: '2026-10-13-fix-b', state: 'cancelled' },
        { key: 'c', title: 'Fix C', brief: 'c' },
        { key: 'd', title: 'Fix D', brief: 'd' },
        { key: 'e', title: 'Fix E', brief: 'e' },
      ],
    });
    const a = app();
    await a.addProject(project);
    expect(epicLines(a)).toContain(
      '"Fix C", "Fix D" and "Fix E" wait on "Fix B", which was cancelled. They do not start on their own: change the plan here to go on.',
    );
  });
});
