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

// Messages only VS Code itself can answer: pick a folder, open a file or folder, save a setting.
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
    case 'open-folder':
      await vscode.commands.executeCommand('vscode.openFolder', vscode.Uri.file(msg.path), {
        forceNewWindow: true,
      });
      return true;
    case 'open-file':
      await vscode.window.showTextDocument(vscode.Uri.file(msg.path), {
        viewColumn: vscode.ViewColumn.Beside,
        preview: true,
      });
      return true;
    default:
      return false;
  }
}
