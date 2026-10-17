import * as vscode from 'vscode';
import type { ThreadRef, ToWebview } from '@/shared';
import { createChatPanels } from './chatPanels';
import type { TreeHost } from './launcher';
import type { MessageContext } from './messages';
import { ownWindowState } from './ownWindow';
import { adoptPanel, createPanel, type PanelHost } from './panel';

type Wiring = Omit<
  MessageContext,
  'post' | 'ready' | 'showChat' | 'focusThread' | 'opened' | 'ownWindow'
>;

// The sidebar tree, and the thread it marks as the one the panel shows.
function treeLink() {
  let tree: TreeHost | null = null;
  let current: ThreadRef | null = null;
  return {
    adopt: (t: TreeHost | null) => {
      tree = t;
    },
    get: () => tree,
    current: () => current,
    opened: (ref: ThreadRef) => {
      current = ref;
      tree?.post({ type: 'focus', ref });
    },
    post: (message: ToWebview) => tree?.post(message),
  };
}

// A VS Code notification with an Open button that shows the thread.
const notifier = (focus: (ref: ThreadRef) => void) => (text: string, ref: ThreadRef) => {
  void vscode.window.showInformationMessage(`Elaia — ${text}`, 'Open').then((choice) => {
    if (choice === 'Open') focus(ref);
  });
};

// The main Elaia panel (if open), the ticket chat panels and the sidebar tree. Every update
// goes to all of them. A thread to focus waits until the main panel says it is ready.
export function createPanelSlot(context: vscode.ExtensionContext) {
  let panel: PanelHost | null = null;
  let pending: ThreadRef | null = null;
  const tree = treeLink();
  let wiring: Wiring | null = null;
  const own = ownWindowState(context, () => panel);
  const closed = () => {
    panel = null;
    own.closed();
  };
  const ready = () => {
    if (pending) panel?.post({ type: 'focus', ref: pending });
    pending = null;
    own.tell();
  };
  const base = () => {
    if (!wiring) throw new Error('Elaia is still starting. Try again in a moment.');
    return wiring;
  };
  const show = () => {
    panel ??= createPanel(context, ctx(), closed);
    panel.reveal();
  };
  const focus = (ref: ThreadRef) => {
    pending = ref;
    show();
    panel?.post({ type: 'focus', ref });
    tree.opened(ref);
  };
  const extra = () => ({ showChat, focusThread: focus, opened: tree.opened, ownWindow: own.move });
  const chats = createChatPanels(context, () => ({
    ...base(),
    ready: () => undefined,
    ...extra(),
  }));
  function showChat(ref: ThreadRef): void {
    chats.show(base().app, ref);
  }
  const ctx = () => ({ ...base(), ready, ...extra() });
  return {
    bind: (w: Wiring) => {
      wiring = w;
    },
    show,
    showChat,
    treeContext: () => ({ ...base(), ...extra() }),
    adoptTree: tree.adopt,
    tree: tree.get,
    current: tree.current,
    adopt: (restored: vscode.WebviewPanel) => {
      own.restore();
      panel = adoptPanel(context, restored, ctx(), closed);
    },
    adoptChat: (restored: vscode.WebviewPanel, state: unknown) => chats.adopt(restored, state),
    post: (message: ToWebview) => [panel, chats, tree].forEach((to) => to?.post(message)),
    isOpen: () => panel !== null,
    isOwnWindow: own.isOn,
    notify: notifier(focus),
  };
}
