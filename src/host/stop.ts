import * as vscode from 'vscode';
import type { ElaiaApi } from './extension';
import { readSettings } from './settings';

// Agents and glafka need POSIX processes and paths (process groups, sh, no .cmd launchers).
export const WINDOWS = 'Elaia runs on macOS and Linux for now.';

// One message, and Open Panel shows it again. Nothing else starts: no app, no agent, no glafka.
function stopWith(context: vscode.ExtensionContext, text: string): ElaiaApi {
  void vscode.window.showErrorMessage(text);
  context.subscriptions.push(
    vscode.commands.registerCommand('elaia.open', () => vscode.window.showErrorMessage(text)),
  );
  return { app: null, isPanelOpen: () => false, isTreeVisible: () => false };
}

// What stops Elaia before it starts: Windows, or bad settings (with the name of what to fix).
export function startProblem(context: vscode.ExtensionContext): ElaiaApi | null {
  if (process.platform === 'win32') return stopWith(context, WINDOWS);
  try {
    readSettings();
    return null;
  } catch (err) {
    return stopWith(context, err instanceof Error ? err.message : String(err));
  }
}
