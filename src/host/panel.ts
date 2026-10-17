import * as vscode from 'vscode';
import type { ThreadRef, ToWebview } from '@/shared';
import { buildHtml, makeNonce } from './html';
import { handleMessage, type MessageContext } from './messages';

export const PANEL_TYPE = 'elaia.panel';

export interface PanelHost {
  post(message: ToWebview): void;
  reveal(): void;
}

function webviewRoot(context: vscode.ExtensionContext) {
  return vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');
}

export function options(context: vscode.ExtensionContext): vscode.WebviewOptions {
  return { enableScripts: true, localResourceRoots: [webviewRoot(context)] };
}

// Opens a new panel in the main editor area. The tree sits in the sidebar next to it.
export function createPanel(
  context: vscode.ExtensionContext,
  ctx: Omit<MessageContext, 'post'>,
  onClose: () => void,
): PanelHost {
  const panel = vscode.window.createWebviewPanel(PANEL_TYPE, 'Elaia', vscode.ViewColumn.One, {
    ...options(context),
    retainContextWhenHidden: false,
  });
  return adoptPanel(context, panel, ctx, onClose);
}

// Our page in any webview: the main panel, a ticket chat, or the sidebar tree.
export function setPage(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
  mode: { thread?: ThreadRef; tree?: boolean },
): void {
  webview.options = options(context);
  const root = webviewRoot(context);
  webview.html = buildHtml({
    scriptUri: webview.asWebviewUri(vscode.Uri.joinPath(root, 'main.js')).toString(),
    styleUri: webview.asWebviewUri(vscode.Uri.joinPath(root, 'main.css')).toString(),
    cspSource: webview.cspSource,
    nonce: makeNonce(),
    ...mode,
  });
}

// Wires a panel up. Also used when VS Code restores a panel after a reload.
export function adoptPanel(
  context: vscode.ExtensionContext,
  panel: vscode.WebviewPanel,
  ctx: Omit<MessageContext, 'post'>,
  onClose: () => void,
  thread?: ThreadRef,
): PanelHost {
  // The tab icon. VS Code picks the file that matches the theme.
  panel.iconPath = {
    light: vscode.Uri.joinPath(context.extensionUri, 'media', 'logo-light-theme.svg'),
    dark: vscode.Uri.joinPath(context.extensionUri, 'media', 'logo-dark-theme.svg'),
  };
  const { webview } = panel;
  setPage(context, webview, { thread });
  const post = (message: ToWebview) => void webview.postMessage(message);
  const listener = webview.onDidReceiveMessage((raw) => handleMessage(raw, { ...ctx, post }));
  panel.onDidChangeViewState(() => {
    if (!panel.visible) ctx.app.viewing(null, false);
  });
  panel.onDidDispose(() => {
    listener.dispose();
    ctx.app.viewing(null, false);
    onClose();
  });
  return { post, reveal: () => panel.reveal() };
}
