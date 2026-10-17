import { mkdirSync } from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import { createApp, type App } from '@/app';
import { installCli } from '@/memory';
import { createStore } from '@/store';
import { CHAT_PANEL_TYPE } from './chatPanels';
import { openReview } from './diff';
import { BASE_SCHEME, baseContent } from './gitFiles';
import { followElaiaTab, registerTree } from './launcher';
import { createLeader } from './leader';
import { PANEL_TYPE } from './panel';
import { createPanelSlot } from './panelSlot';
import { readSettings } from './settings';
import { watchForUpdate } from './updated';
import { createWatchers } from './watchers';

export interface ElaiaApi {
  app: App | null;
  isPanelOpen(): boolean;
  // The sidebar tree is on screen (so the left-bar icon looks selected).
  isTreeVisible(): boolean;
}

// Bad settings stop Elaia here, with the name of what to fix.
function settingsProblem(context: vscode.ExtensionContext): ElaiaApi | null {
  try {
    readSettings();
    return null;
  } catch (err) {
    const text = err instanceof Error ? err.message : String(err);
    void vscode.window.showErrorMessage(text);
    context.subscriptions.push(
      vscode.commands.registerCommand('elaia.open', () => vscode.window.showErrorMessage(text)),
    );
    return { app: null, isPanelOpen: () => false, isTreeVisible: () => false };
  }
}

export function activate(context: vscode.ExtensionContext): ElaiaApi {
  const problem = settingsProblem(context);
  if (problem) return problem;

  const root = context.globalStorageUri.fsPath;
  mkdirSync(root, { recursive: true });
  // The `elaia` command every agent gets on its PATH. Rewritten each start: the path changes with updates.
  const cli = path.join(context.extensionPath, 'dist', 'elaia-cli.cjs');
  try {
    installCli(root, cli, process.execPath);
  } catch (err) {
    void vscode.window.showWarningMessage(`Elaia: agents cannot search past work: ${String(err)}`);
  }
  const leader = createLeader(root);
  leader.tick();
  const slot = createPanelSlot(context);
  const app = createApp({
    store: createStore(root),
    settings: readSettings,
    post: slot.post,
    notify: slot.notify,
    isLeader: leader.isLeader,
    now: () => new Date().toISOString(),
    confirm: async (text, yes) =>
      (await vscode.window.showWarningMessage(text, { modal: true }, yes)) === yes,
  });
  const watchers = createWatchers(app, leader.tick, slot.isOpen);
  slot.bind({ app, projectsChanged: () => watchers.sync() });

  context.subscriptions.push(
    vscode.commands.registerCommand('elaia.open', slot.show),
    vscode.window.registerWebviewPanelSerializer(PANEL_TYPE, {
      async deserializeWebviewPanel(restored) {
        slot.adopt(restored);
      },
    }),
    vscode.window.registerWebviewPanelSerializer(CHAT_PANEL_TYPE, {
      async deserializeWebviewPanel(restored, state) {
        slot.adoptChat(restored, state);
      },
    }),
    vscode.workspace.registerTextDocumentContentProvider(BASE_SCHEME, baseContent),
    // Not in the menu: the panel's "Open diff" button and the smoke test use it.
    vscode.commands.registerCommand('elaia.openReview', (project: string, ticket: string) =>
      openReview(app, { project, thread: ticket }, slot.showChat),
    ),
    watchForUpdate(context),
    // The sidebar tree; opening it opens the panel. It follows the Elaia tab, so the
    // left-bar icon looks selected exactly while Elaia is the tab you are on.
    registerTree(context, slot.treeContext, {
      adopt: slot.adoptTree,
      current: slot.current,
      visible: slot.show,
    }),
    followElaiaTab(slot.tree, slot.isOwnWindow),
    { dispose: () => (watchers.dispose(), app.dispose(), leader.release()) },
  );
  app.load();
  watchers.sync();
  void app.refreshAll();
  return {
    app,
    isPanelOpen: slot.isOpen,
    isTreeVisible: () => slot.tree()?.visible() ?? false,
  };
}

export function deactivate(): void {
  // Everything is disposed through context.subscriptions.
}
