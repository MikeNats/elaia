import * as vscode from 'vscode';
import type { App } from '@/app';
import { threadKey, type ThreadRef, type ToWebview } from '@/shared';
import type { MessageContext } from './messages';
import { adoptPanel, options, type PanelHost } from './panel';

export const CHAT_PANEL_TYPE = 'elaia.ticketChat';

// The small chat under a review: one ticket's thread, one panel per ticket.
export function createChatPanels(
  context: vscode.ExtensionContext,
  ctx: () => Omit<MessageContext, 'post'>,
) {
  const open = new Map<string, PanelHost>();
  const add = (panel: vscode.WebviewPanel, ref: ThreadRef) => {
    const key = threadKey(ref);
    open.set(
      key,
      adoptPanel(context, panel, ctx(), () => open.delete(key), ref),
    );
  };
  return {
    show(app: App, ref: ThreadRef): void {
      const existing = open.get(threadKey(ref));
      if (existing) return existing.reveal();
      const title = `Chat: ${app.ticket(ref)?.title ?? ref.thread}`;
      const panel = vscode.window.createWebviewPanel(
        CHAT_PANEL_TYPE,
        title,
        vscode.ViewColumn.Two,
        options(context),
      );
      add(panel, ref);
    },
    // After a reload VS Code hands the panel back with the state its page saved.
    adopt(panel: vscode.WebviewPanel, state: unknown): void {
      const ref = (state as { selected?: ThreadRef } | undefined)?.selected;
      if (ref) add(panel, ref);
      else panel.dispose();
    },
    post(message: ToWebview): void {
      for (const panel of open.values()) panel.post(message);
    },
  };
}
