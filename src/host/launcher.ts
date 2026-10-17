import * as vscode from 'vscode';
import type { ThreadRef, ToWebview } from '@/shared';
import { handleMessage, type MessageContext } from './messages';
import { PANEL_TYPE, setPage } from './panel';

export const LAUNCHER_VIEW = 'elaia.launcher';

export interface TreeHost {
  post(message: ToWebview): void;
  visible(): boolean;
}

// Elaia's sidebar: the tree of projects, epics and tickets. Opening it opens the Elaia panel.
// Kept alive while hidden: it opens and closes with the Elaia tab.
export function registerTree(
  context: vscode.ExtensionContext,
  ctx: () => Omit<MessageContext, 'post' | 'ready'>,
  hooks: { adopt(tree: TreeHost | null): void; current(): ThreadRef | null; visible(): void },
): vscode.Disposable {
  return vscode.window.registerWebviewViewProvider(
    LAUNCHER_VIEW,
    {
      resolveWebviewView(view) {
        setPage(context, view.webview, { tree: true });
        const post = (message: ToWebview) => void view.webview.postMessage(message);
        // When the tree loads, it marks the thread the panel shows.
        const ready = () => {
          const ref = hooks.current();
          if (ref) post({ type: 'focus', ref });
        };
        view.webview.onDidReceiveMessage((raw) => handleMessage(raw, { ...ctx(), post, ready }));
        hooks.adopt({ post, visible: () => view.visible });
        view.onDidDispose(() => hooks.adopt(null));
        if (view.visible) hooks.visible();
        view.onDidChangeVisibility(() => {
          if (view.visible) hooks.visible();
        });
      },
    },
    { webviewOptions: { retainContextWhenHidden: true } },
  );
}

const onElaiaTab = () => {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  return input instanceof vscode.TabInputWebview && input.viewType.endsWith(PANEL_TYPE);
};

// VS Code shows the left-bar icon as selected only while its sidebar is open. So the sidebar
// follows the Elaia tab: open while that tab is active, closed when you go to another tab.
export function followElaiaTab(
  tree: () => TreeHost | null,
  ownWindow: () => boolean,
): vscode.Disposable {
  let timer: NodeJS.Timeout | undefined;
  const check = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // In its own window the tab has its own tree; the main window's sidebar is yours.
      if (ownWindow()) return;
      const open = tree()?.visible() ?? false;
      const run = (command: string) => void vscode.commands.executeCommand(command);
      if (onElaiaTab() && !open) run('workbench.view.extension.elaia');
      else if (!onElaiaTab() && open) run('workbench.action.closeSidebar');
    }, 80);
  };
  const { tabGroups } = vscode.window;
  return vscode.Disposable.from(
    tabGroups.onDidChangeTabs(check),
    tabGroups.onDidChangeTabGroups(check),
    { dispose: () => clearTimeout(timer) },
  );
}
