import { unwatchFile, watchFile } from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';

// A new install replaces Elaia's files, but this window keeps running the old code until reload.
export function watchForUpdate(context: vscode.ExtensionContext): vscode.Disposable {
  const file = path.join(context.extensionPath, 'dist', 'extension.cjs');
  let asked = false;
  watchFile(file, { interval: 5000 }, (now, before) => {
    if (asked || now.mtimeMs === 0 || now.mtimeMs === before.mtimeMs) return;
    asked = true;
    void vscode.window
      .showInformationMessage('Elaia was updated. Reload the window to use it.', 'Reload')
      .then((choice) => {
        if (choice === 'Reload')
          void vscode.commands.executeCommand('workbench.action.reloadWindow');
      });
  });
  return { dispose: () => unwatchFile(file) };
}
