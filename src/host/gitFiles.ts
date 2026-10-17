import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const run = promisify(execFile);
const MAX_OUTPUT = 64 * 1024 * 1024;
const git = async (cwd: string, args: string[]) =>
  (await run('git', args, { cwd, maxBuffer: MAX_OUTPUT })).stdout;

// Shows a file as it was at a commit. An empty ref, or a file missing there, reads as empty.
export const BASE_SCHEME = 'elaia-base';

export function baseUri(worktree: string, ref: string, file: string): vscode.Uri {
  return vscode.Uri.from({
    scheme: BASE_SCHEME,
    path: `/${file}`,
    query: JSON.stringify({ worktree, ref }),
  });
}

export const baseContent: vscode.TextDocumentContentProvider = {
  async provideTextDocumentContent(uri) {
    const { worktree, ref } = JSON.parse(uri.query) as { worktree: string; ref: string };
    if (!ref) return '';
    return git(worktree, ['show', `${ref}:${uri.path.slice(1)}`]).catch(() => '');
  },
};

export interface Change {
  // Where the file was at the base (null when added), and where it is now (null when deleted).
  before: string | null;
  after: string | null;
}

// Everything the ticket changed since it left the base branch: commits, edits not yet
// committed, and new files. That is what a review needs, not only what was committed.
export async function changesSince(
  worktree: string,
  base: string,
): Promise<{ from: string; changes: Change[] }> {
  const from = (await git(worktree, ['merge-base', base, 'HEAD'])).trim();
  const tracked = (await git(worktree, ['diff', '--name-status', '-M', from]))
    .split('\n')
    .filter(Boolean)
    .map((line): Change => {
      const [status = '', first = '', second] = line.split('\t');
      if (status.startsWith('A')) return { before: null, after: first };
      if (status.startsWith('D')) return { before: first, after: null };
      if (status.startsWith('R')) return { before: first, after: second ?? first };
      return { before: first, after: first };
    });
  const untracked = (await git(worktree, ['ls-files', '--others', '--exclude-standard']))
    .split('\n')
    .filter(Boolean)
    .map((file): Change => ({ before: null, after: file }));
  return { from, changes: [...tracked, ...untracked] };
}
