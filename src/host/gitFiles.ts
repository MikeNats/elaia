import * as vscode from 'vscode';
import type { App } from '@/app';
import type { ThreadRef } from '@/shared';
import { baseQuery, baseText } from './git';

// Shows a file as it was at a commit. An empty ref, or a file missing there, reads as empty.
export const BASE_SCHEME = 'elaia-base';

export function baseUri(ticket: ThreadRef, ref: string, file: string): vscode.Uri {
  return vscode.Uri.from({ scheme: BASE_SCHEME, path: `/${file}`, query: baseQuery(ticket, ref) });
}

// The link names a ticket; its folder comes from the tickets Elaia knows, never from the link.
export const baseContent = (app: App): vscode.TextDocumentContentProvider => ({
  provideTextDocumentContent: (uri) =>
    baseText(uri.query, uri.path.slice(1), (t) => app.ticket(t)?.worktree ?? null),
});
