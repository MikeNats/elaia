import { describe, expect, it, vi } from 'vitest';
import { focusQueue } from '@/host/focusQueue';

const A = { project: '/repo', thread: 'A' };
const B = { project: '/repo', thread: 'B' };

describe('focusQueue', () => {
  it('does not send a focus again when a loaded panel loads again', () => {
    const send = vi.fn();
    const queue = focusQueue(send);
    queue.ready();
    queue.focus(A, true);
    // You open B in the panel, switch tabs and come back: the page loads again.
    queue.ready();
    expect(send.mock.calls).toEqual([[A]]);
  });

  it('sends a focus asked for before a new panel is ready once it is', () => {
    const send = vi.fn();
    const queue = focusQueue(send);
    queue.focus(A, false);
    queue.ready();
    expect(send.mock.calls).toEqual([[A], [A]]);
  });

  it('sends a focus asked for while the panel is hidden once it loads again', () => {
    const send = vi.fn();
    const queue = focusQueue(send);
    queue.ready();
    queue.focus(B, false);
    queue.ready();
    expect(send.mock.calls).toEqual([[B], [B]]);
  });

  it('waits for ready again after the panel closes', () => {
    const send = vi.fn();
    const queue = focusQueue(send);
    queue.ready();
    queue.reset();
    queue.focus(A, true);
    queue.ready();
    expect(send.mock.calls).toEqual([[A], [A]]);
  });

  it('forgets a waiting focus when the panel closes', () => {
    const send = vi.fn();
    const queue = focusQueue(send);
    queue.focus(A, false);
    queue.reset();
    queue.ready();
    expect(send.mock.calls).toEqual([[A]]);
  });
});
