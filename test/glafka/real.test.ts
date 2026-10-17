import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '@/app';
import { glafkaClient, runGlafka } from '@/glafka';
import { createStore } from '@/store';
import { FAKE_CLAUDE } from '../support/fakeClaude';

// Runs the real glafka on PATH (or GLAFKA_BIN). It must be a version with --json.
const BIN = process.env.GLAFKA_BIN ?? 'glafka';
const glafka = glafkaClient(BIN);
let repo: string;

function gitRepo(): string {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-real-')));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, stdio: 'ignore' });
  git('init', '-q', '-b', 'main');
  git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '--allow-empty', '-m', 'init');
  return dir;
}

beforeEach(() => {
  repo = gitRepo();
});

describe('Elaia against the real glafka', () => {
  it('creates a ticket and reads it back through the JSON contract', async () => {
    const id = await glafka.create(repo, 'add csv export');
    expect(id).toMatch(/add-csv-export$/);
    const tickets = await glafka.tickets(repo);
    expect(tickets.map((t) => [t.id, t.position])).toEqual([[id, 'brainstorming']]);
    expect((await glafka.ticket(repo, id))?.summary.text).toContain(id);
    expect(await glafka.tokens(repo)).toEqual([]);
  });

  it('follows a ticket from creation to cancel, then writes its thread into the repo', async () => {
    const app = createApp({
      store: createStore(mkdtempSync(path.join(tmpdir(), 'elaia-real-store-'))),
      settings: () => ({
        workflow: 'glafka',
        glafkaPath: BIN,
        platform: 'claude',
        agent: 'claude',
        claudePath: FAKE_CLAUDE,
        agentCommand: '',
        permissionMode: 'acceptEdits',
        allowedTools: [],
        autoAdvance: false,
      }),
      post: () => undefined,
      notify: () => undefined,
      isLeader: () => true,
      now: () => new Date().toISOString(),
    });
    const id = await glafka.create(repo, 'add csv export');
    await app.addProject(repo);
    const ref = { project: repo, thread: id };
    expect(app.store.threads.read(ref).map((e) => e.text)).toEqual([
      'Ticket found — brainstorming',
    ]);

    const cancel = await runGlafka(BIN, ['cancel', id], repo);
    expect(cancel.code).toBe(0);
    await app.refresh(repo);

    const file = path.join(repo, '.elaia', 'chats', `${id}.jsonl`);
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('Ticket cancelled');
  });
});
