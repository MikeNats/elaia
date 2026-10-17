import * as vscode from 'vscode';
import type { PanelHost } from './panel';

const MOVE = {
  on: 'workbench.action.moveEditorToNewWindow',
  off: 'workbench.action.restoreEditorsToMainWindow',
};
const OWN_KEY = 'elaia.ownWindow';

// VS Code moves only editor tabs to a new window; the sidebar stays behind. So in its own
// window the Elaia tab shows its own tree. Remembered: VS Code brings that window back.
export function ownWindowState(context: vscode.ExtensionContext, panel: () => PanelHost | null) {
  let own = false;
  const set = (on: boolean) => {
    own = on;
    void context.workspaceState.update(OWN_KEY, on);
  };
  return {
    isOn: () => own,
    restore: () => {
      own = context.workspaceState.get<boolean>(OWN_KEY) === true;
    },
    closed: () => set(false),
    // A moved tab loads its page again: tell it where it is.
    tell: () => panel()?.post({ type: 'own-window', on: own }),
    move: async (on: boolean) => {
      const now = panel();
      if (!now || on === own) return;
      now.reveal();
      await vscode.commands.executeCommand(on ? MOVE.on : MOVE.off);
      set(on);
      panel()?.post({ type: 'own-window', on });
    },
  };
}
