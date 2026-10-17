import type * as vscode from 'vscode';
import { describe, expect, it, vi } from 'vitest';
import type { ThreadRef, ToWebview } from '@/shared';

interface PageCtx {
  ready(): void;
  focusThread(ref: ThreadRef): void;
}

// The fake panel: what it was sent, whether it is on screen, and the context it was given.
const page = vi.hoisted(() => ({
  sent: [] as unknown[],
  visible: true,
  ctx: null as PageCtx | null,
}));

vi.mock('vscode', () => ({ window: {}, commands: {} }));
vi.mock('@/host/panel', () => ({
  createPanel: (_context: unknown, ctx: PageCtx) => {
    page.ctx = ctx;
    return {
      post: (message: unknown) => page.sent.push(message),
      reveal: () => undefined,
      visible: () => page.visible,
    };
  },
  adoptPanel: vi.fn(),
  options: vi.fn(),
}));

import { createPanelSlot } from '@/host/panelSlot';

const A = { project: '/repo', thread: 'A' };

// Opens the main panel and returns the context its page talks to.
function openPanel(): PageCtx {
  page.sent = [];
  page.visible = true;
  page.ctx = null;
  const context = {
    workspaceState: { get: () => undefined, update: async () => undefined },
  } as unknown as vscode.ExtensionContext;
  const slot = createPanelSlot(context);
  slot.bind({ app: {} as never, projectsChanged: () => undefined });
  slot.show();
  if (!page.ctx) throw new Error('the panel was not created');
  return page.ctx;
}

const focusSent = () => page.sent.filter((m) => (m as ToWebview).type === 'focus');

describe('panel slot focus', () => {
  it('does not jump back to an old thread after a tab switch', () => {
    const ctx = openPanel();
    ctx.ready();
    ctx.focusThread(A);
    // You open B in the panel, switch tabs and come back: the page loads and says ready.
    ctx.ready();
    expect(focusSent()).toEqual([{ type: 'focus', ref: A }]);
  });

  it('shows a thread asked for while the panel is hidden once it loads', () => {
    const ctx = openPanel();
    ctx.ready();
    page.visible = false;
    ctx.focusThread(A);
    ctx.ready();
    expect(focusSent()).toEqual([
      { type: 'focus', ref: A },
      { type: 'focus', ref: A },
    ]);
  });
});
