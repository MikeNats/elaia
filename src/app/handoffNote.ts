import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { handoffsDir, MEMORY_TOOLS, prepareElaiaDir } from '@/memory';
import type { ThreadEntry, ThreadRef } from '@/shared';
import { agentFor } from './agent';
import type { AppState } from './types';

const ASK = [
  'Elaia: this chat is nearly full. A fresh agent will take over from you.',
  'Write a handoff note for it in Markdown, at most 50 lines, with these headings:',
  '## Goal, ## Rules I was given (copy them word for word), ## Decided (and why),',
  '## Done so far, ## Open questions, ## Next step.',
  'Name files, ticket ids and commands exactly. Do not use any tools. Reply with the note only.',
].join('\n');

const WORDS = new Set<ThreadEntry['kind']>(['agent', 'question', 'approval']);

// Asks the old agent for the note, on its own session, without showing it as a chat reply.
export async function askOldAgent(app: AppState, ref: ThreadRef, folder: string, session: string) {
  const said: string[] = [];
  const store = app.deps.store;
  const quiet = {
    ...store,
    threads: { ...store.threads, append: () => undefined },
    sessions: {
      ...store.sessions,
      get: () => session,
      set: () => undefined,
      forget: () => undefined,
    },
  };
  const agent = { ...agentFor(app, ref), readOnly: true, allowedTools: MEMORY_TOOLS };
  const deps = {
    store: quiet,
    now: app.deps.now,
    emit: (_: ThreadRef, entries: ThreadEntry[]) => {
      // A refused-tool card is not part of the note.
      const refused = (e: ThreadEntry) => e.actions?.some((a) => a.kind === 'allow');
      for (const e of entries)
        if (e.source === 'chat' && WORDS.has(e.kind) && !refused(e)) said.push(e.text);
    },
  };
  await app.turns.run(deps, { ref, folder, text: '', prompt: ASK, agent });
  return said.join('\n\n').trim();
}

// A note's file name is its time; the same shape compares with a Clear's time.
const stampOf = (at: string) => at.replace(/[:.]/g, '-');

// What a fresh agent may see: the shown entries after your last Clear, and that Clear's time.
export function sinceClear(app: AppState, ref: ThreadRef, count: number) {
  const all = app.deps.store.threads.read(ref);
  const cut = all.findLastIndex((e) => e.kind === 'cleared');
  return {
    tail: all
      .slice(cut + 1)
      .filter((e) => e.shown)
      .slice(-count),
    clearedAt: all[cut]?.at ?? null,
  };
}

// When the old agent cannot answer: the last things said, so nothing is lost.
export function fromThread(app: AppState, ref: ThreadRef): string {
  const { tail } = sinceClear(app, ref, 20);
  const lines = tail.map((e) => `- ${e.kind === 'you' ? 'You' : 'Agent'}: ${e.text.slice(0, 400)}`);
  return ['The agent could not write a note. The last messages:', '', ...lines].join('\n');
}

// The newest note, but none written before your last Clear.
export function latestHandoff(ref: ThreadRef, clearedAt: string | null = null): string | null {
  const dir = handoffsDir(ref.project, ref.thread);
  if (!existsSync(dir)) return null;
  const after = clearedAt ? stampOf(clearedAt) : '';
  const last = readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f > after)
    .sort()
    .at(-1);
  return last ? readFileSync(path.join(dir, last), 'utf8') : null;
}

export function save(app: AppState, ref: ThreadRef, text: string, about: string): string {
  const dir = handoffsDir(ref.project, ref.thread);
  prepareElaiaDir(ref.project);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${stampOf(app.deps.now())}.md`);
  const head = [
    `# Handoff — chat ${ref.thread}`,
    '',
    about,
    '',
    `Whole chat: \`elaia show thread:${ref.thread}\``,
  ];
  writeFileSync(file, `${[...head, '', text].join('\n')}\n`);
  return path.relative(ref.project, file);
}
