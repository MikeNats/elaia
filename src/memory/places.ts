import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Elaia's own folder in each repo, for chats and handoff notes. Git ignores it: it holds
// its own .gitignore, so the repo's .gitignore is never touched.
export const elaiaDir = (project: string) => path.join(project, '.elaia');
export const chatsDir = (project: string) => path.join(elaiaDir(project), 'chats');

// Thread names are ticket ids, `project` or `epic-<slug>`; anything else is made file-safe.
const safe = (thread: string) => thread.replace(/[^A-Za-z0-9._-]/g, '_') || '_';

export const chatFile = (project: string, thread: string) =>
  path.join(chatsDir(project), `${safe(thread)}.jsonl`);
export const handoffsDir = (project: string, thread: string) =>
  path.join(elaiaDir(project), 'handoffs', safe(thread));

// Makes the folder, ignored by git, before Elaia writes into it.
export function prepareElaiaDir(project: string): void {
  const ignore = path.join(elaiaDir(project), '.gitignore');
  if (existsSync(ignore)) return;
  mkdirSync(elaiaDir(project), { recursive: true });
  writeFileSync(ignore, '# Elaia keeps chats and handoff notes here, on this machine only.\n*\n');
}
