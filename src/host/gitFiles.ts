import * as vscode from 'vscode';
import { git } from './git';

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
