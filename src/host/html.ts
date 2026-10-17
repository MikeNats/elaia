import { randomBytes } from 'node:crypto';

export const makeNonce = () => randomBytes(16).toString('base64url');

// The page shell. Only our own bundle may run: a nonce for the script, no inline anything.
export function buildHtml(o: {
  scriptUri: string;
  styleUri: string;
  cspSource: string;
  nonce: string;
  // Set for a ticket chat panel: the page shows only this thread.
  thread?: { project: string; thread: string };
  // Set for the sidebar: the page shows only the tree.
  tree?: boolean;
}): string {
  const thread = o.thread
    ? ` data-thread="${escapeAttr(JSON.stringify(o.thread))}"`
    : o.tree
      ? ' data-mode="tree"'
      : '';
  const csp = [
    "default-src 'none'",
    `img-src ${o.cspSource} data:`,
    `style-src ${o.cspSource}`,
    `font-src ${o.cspSource}`,
    `script-src 'nonce-${o.nonce}'`,
  ].join('; ');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="stylesheet" href="${o.styleUri}" />
    <title>Elaia</title>
  </head>
  <body>
    <div id="root"${thread}></div>
    <script nonce="${o.nonce}" src="${o.scriptUri}"></script>
  </body>
</html>`;
}

function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
