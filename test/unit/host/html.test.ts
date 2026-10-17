import { describe, expect, it } from 'vitest';
import { buildHtml, makeNonce } from '@/host/html';

describe('panel html', () => {
  it('lets only our nonce-tagged bundle run', () => {
    const html = buildHtml({
      scriptUri: 'vscode-webview://x/main.js',
      styleUri: 'vscode-webview://x/main.css',
      cspSource: 'vscode-webview://x',
      nonce: 'abc123',
    });
    expect(html).toContain("script-src 'nonce-abc123'");
    expect(html).toContain('<script nonce="abc123" src="vscode-webview://x/main.js">');
    expect(html).not.toContain('unsafe-inline');
    expect(html).not.toContain('unsafe-eval');
  });

  it('makes a new nonce each time', () => {
    expect(makeNonce()).not.toBe(makeNonce());
  });
});
