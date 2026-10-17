import path from 'node:path';
import * as vscode from 'vscode';
import type { App } from '@/app';
import type { ThreadRef } from '@/shared';
import { changesSince } from './git';
import { baseUri } from './gitFiles';

// Diff on top (70%), the ticket chat underneath (30%).
const REVIEW_LAYOUT = { orientation: 1, groups: [{ size: 0.7 }, { size: 0.3 }] };

// The review: VS Code's own side-by-side diff of every changed file, old left, new right.
// The new side is the real file, so edits from the chat show up at once.
export async function openReview(
  app: App,
  ref: ThreadRef,
  showChat: (ref: ThreadRef) => void,
): Promise<void> {
  const ticket = app.ticket(ref);
  if (!ticket?.worktree)
    throw new Error('This ticket has no worktree yet, so there is nothing to review.');
  const worktree = ticket.worktree;
  const base = app.workflowFor(ref.project).baseRef(ref.project);
  const { from, changes } = await changesSince(worktree, base);
  if (changes.length === 0) {
    void vscode.window.showInformationMessage(`Elaia: no changes in ${ticket.id} yet.`);
    return;
  }
  const resources = changes.map((c) => {
    const file = c.after ?? c.before ?? '';
    const before = baseUri(worktree, c.before ? from : '', c.before ?? file);
    const after = c.after
      ? vscode.Uri.file(path.join(worktree, c.after))
      : baseUri(worktree, '', file);
    return [vscode.Uri.file(path.join(worktree, file)), before, after];
  });
  await vscode.commands.executeCommand('vscode.setEditorLayout', REVIEW_LAYOUT);
  await vscode.commands.executeCommand('workbench.action.focusFirstEditorGroup');
  await vscode.commands.executeCommand(
    'vscode.changes',
    `Review: ${ticket.title ?? ticket.id}`,
    resources,
  );
  showChat(ref);
}
