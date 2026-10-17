import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ToWebview } from '@/shared';
import { makeTicket } from '../support/ticket';

const postMessage = vi.fn();
let App: typeof import('@/webview/App').App;

beforeAll(async () => {
  // What VS Code gives a webview. Set before the app first asks for it.
  (globalThis as Record<string, unknown>).acquireVsCodeApi = () => ({
    postMessage,
    getState: () => null,
    setState: () => undefined,
  });
  ({ App } = await import('@/webview/App'));
});
afterEach(cleanup);

function fromHost(message: ToWebview) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: message }));
  });
}

describe('App', () => {
  it('says hello to the host, and opens the thread the sidebar asks for', () => {
    render(<App />);
    expect(postMessage).toHaveBeenCalledWith({ type: 'ready' });

    const ticket = makeTicket({ id: 't1', title: 'add csv export' });
    fromHost({
      type: 'snapshot',
      snapshot: {
        projects: [
          {
            path: '/r/frontline',
            name: 'frontline',
            tickets: [ticket],
            tokens: [],
            chatTokens: {},
            epics: [],
            error: null,
          },
        ],
        agentName: 'Claude',
        busy: [],
      },
    });
    // The tree is in the sidebar now: a click there reaches the panel as "focus".
    fromHost({ type: 'focus', ref: { project: '/r/frontline', thread: 't1' } });
    expect(postMessage).toHaveBeenCalledWith({
      type: 'open-thread',
      project: '/r/frontline',
      thread: 't1',
    });

    fromHost({
      type: 'thread',
      ref: { project: '/r/frontline', thread: 't1' },
      entries: [
        { at: 'x', kind: 'progress', text: 'Coder started', shown: true, source: 'glafka' },
      ],
    });
    expect(screen.getByText('Coder started')).toBeTruthy();
    expect(screen.getByText('frontline › add csv export')).toBeTruthy();
    expect(screen.getByText('Stage')).toBeTruthy();
  });

  it('shows an error from the host until you dismiss it', () => {
    render(<App />);
    fromHost({ type: 'error', text: 'glafka was not found' });
    expect(screen.getByRole('alert').textContent).toContain('glafka was not found');
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
