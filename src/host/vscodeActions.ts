import * as vscode from 'vscode';
import type { ToHost } from '@/shared';
import type { MessageContext } from './messages';

async function pickProject(ctx: MessageContext): Promise<void> {
  const picked = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Add to Elaia',
  });
  const folder = picked?.[0]?.fsPath;
  if (!folder) return;
  await ctx.app.addProject(folder);
  ctx.projectsChanged();
}

// Messages only VS Code itself can answer: pick a folder, open a worktree, save a setting.
// Returns true when the message was one of them.
export async function vscodeAction(msg: ToHost, ctx: MessageContext): Promise<boolean> {
  switch (msg.type) {
    case 'add-project':
      await pickProject(ctx);
      return true;
    case 'set-permissions':
      await vscode.workspace
        .getConfiguration('elaia')
        .update('permissions', msg.mode, vscode.ConfigurationTarget.Global);
      ctx.app.snapshot();
      return true;
    case 'own-window':
      await ctx.ownWindow(msg.on);
      return true;
    case 'open-folder': {
      const worktree = ctx.app.ticket({ project: msg.project, thread: msg.ticket })?.worktree;
      if (!worktree) {
        ctx.post({ type: 'error', text: `Ticket ${msg.ticket} has no worktree yet.` });
        return true;
      }
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(worktree), {
        forceNewWindow: true,
      });
      return true;
    }
    default:
      return false;
  }
}
