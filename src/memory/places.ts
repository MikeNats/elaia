import { lstatSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

const IGNORE = '# Elaia keeps chats and handoff notes here, on this machine only.\n*\n';

// What is at `p`, without following a symlink. Null when nothing is there.
function kindOf(p: string): 'link' | 'dir' | 'other' | null {
  try {
    const s = lstatSync(p);
    return s.isSymbolicLink() ? 'link' : s.isDirectory() ? 'dir' : 'other';
  } catch {
    return null;
  }
}

// A repo may ship a symlink here, to send chats where git does not ignore them.
function noLink(p: string): void {
  if (kindOf(p) === 'link') throw new Error(`${p} is a symlink. Elaia writes nothing there.`);
}

// The project folder itself may be a symlink you added; that one is followed.
function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// Makes `dir` (.elaia or a folder in it), ignored by git, before Elaia writes into it. Throws,
// with a plain reason, when Elaia must not write: it never makes a deleted project folder
// again, and never writes through a symlink.
export function prepareElaiaDir(project: string, dir: string): void {
  if (!isDir(project)) throw new Error(`The project folder is missing: ${project}`);
  const root = elaiaDir(project);
  const rel = path.relative(root, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${dir} is not in ${root}`);
  noLink(root);
  if (kindOf(root) === null) mkdirSync(root);
  // Elaia's own text, whatever the repo shipped: anything else may let git commit the chats.
  const ignore = path.join(root, '.gitignore');
  noLink(ignore);
  if (kindOf(ignore) === null || readFileSync(ignore, 'utf8') !== IGNORE)
    writeFileSync(ignore, IGNORE);
  let folder = root;
  for (const part of rel.split(path.sep).filter(Boolean)) {
    folder = path.join(folder, part);
    noLink(folder);
    if (kindOf(folder) === null) mkdirSync(folder);
  }
}
