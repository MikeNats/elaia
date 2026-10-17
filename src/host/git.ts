import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { ThreadRef } from '@/shared';

const run = promisify(execFile);
const MAX_OUTPUT = 64 * 1024 * 1024;
export const git = async (cwd: string, args: string[]): Promise<string> =>
  (await run('git', args, { cwd, maxBuffer: MAX_OUTPUT })).stdout;

export interface Change {
  // Where the file was at the base (null when added), and where it is now (null when deleted).
  before: string | null;
  after: string | null;
}

// `git diff --name-status -z`: "M\0a.md\0R100\0old.md\0new.md\0". A status, then one name
// (two for a rename). With -z git never quotes a name, so Greek and accented letters stay as they are.
function parseNameStatus(out: string): Change[] {
  const parts = out.split('\0');
  const changes: Change[] = [];
  let i = 0;
  while (i + 1 < parts.length) {
    const status = parts[i++] ?? '';
    const first = parts[i++] ?? '';
    if (status.startsWith('R')) changes.push({ before: first, after: parts[i++] ?? first });
    else if (status.startsWith('A')) changes.push({ before: null, after: first });
    else if (status.startsWith('D')) changes.push({ before: first, after: null });
    else changes.push({ before: first, after: first });
  }
  return changes;
}

// Everything the ticket changed since it left the base branch: commits, edits not yet
// committed, and new files. That is what a review needs, not only what was committed.
export async function changesSince(
  worktree: string,
  base: string,
): Promise<{ from: string; changes: Change[] }> {
  const from = (await git(worktree, ['merge-base', base, 'HEAD'])).trim();
  const tracked = parseNameStatus(await git(worktree, ['diff', '--name-status', '-z', '-M', from]));
  const untracked = (await git(worktree, ['ls-files', '-z', '--others', '--exclude-standard']))
    .split('\0')
    .filter(Boolean)
    .map((file): Change => ({ before: null, after: file }));
  return { from, changes: [...tracked, ...untracked] };
}

// The diff link names the ticket and a commit, never a folder: Elaia looks the folder up itself.
const BaseQuery = z.strictObject({ project: z.string(), thread: z.string(), ref: z.string() });
// A full commit id, as git merge-base prints it (sha-1 or sha-256).
const COMMIT = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

export const baseQuery = (ticket: ThreadRef, ref: string): string =>
  JSON.stringify({ project: ticket.project, thread: ticket.thread, ref });

function parseQuery(query: string) {
  try {
    return BaseQuery.safeParse(JSON.parse(query)).data ?? null;
  } catch {
    return null;
  }
}

// A file as it was at a commit. A link Elaia did not make reads as empty and runs no git:
// bad JSON, an unknown ticket, or a ref that is not a commit id (such as --output=x).
export async function baseText(
  query: string,
  file: string,
  worktreeOf: (ticket: ThreadRef) => string | null,
): Promise<string> {
  const q = parseQuery(query);
  if (!q || !COMMIT.test(q.ref)) return '';
  const worktree = worktreeOf({ project: q.project, thread: q.thread });
  if (!worktree) return '';
  return git(worktree, ['show', `${q.ref}:${file}`]).catch(() => '');
}
