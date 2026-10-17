import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Thread } from '@/webview/Thread';
import { MessageBox } from '@/webview/MessageBox';
import type { ThreadEntry } from '@/shared';

afterEach(cleanup);
const ref = { project: '/p', thread: 't1' };
const e = (kind: ThreadEntry['kind'], text: string, shown = true, extra = {}): ThreadEntry => ({
  at: '2026-10-13T10:00:00Z',
  kind,
  text,
  shown,
  source: 'chat',
  ...extra,
});

describe('Thread', () => {
  it('hides tool work until you ask for details', () => {
    const entries = [e('you', 'go'), e('tool', 'Read — a.ts', false), e('agent', 'done')];
    render(
      <Thread
        title="t1"
        threadRef={ref}
        entries={entries}
        agentName="Claude"
        busy={false}
        post={vi.fn()}
      />,
    );
    expect(screen.queryByText('Read — a.ts')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /show details \(1 hidden\)/i }));
    expect(screen.getByText('Read — a.ts')).toBeTruthy();
  });

  it('turns entry buttons into messages to the host', () => {
    const post = vi.fn();
    const approval = e('approval', 'Start the coder? (y/n)', true, {
      actions: [{ kind: 'reply', label: 'Yes', value: 'yes' }],
    });
    const denied = e('approval', 'Not allowed yet: Write', true, {
      actions: [{ kind: 'allow', label: 'Allow Write and retry', value: 'Write' }],
    });
    render(
      <Thread
        title="t1"
        threadRef={ref}
        entries={[approval, denied]}
        agentName="Claude"
        busy={false}
        post={post}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Allow Write and retry' }));
    expect(post).toHaveBeenCalledWith({ type: 'send', ...ref, text: 'yes' });
    expect(post).toHaveBeenCalledWith({ type: 'allow', ...ref, tool: 'Write' });
  });
});

describe('MessageBox', () => {
  it('sends on Enter and clears the box', () => {
    const post = vi.fn();
    render(<MessageBox threadRef={ref} busy={false} post={post} />);
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: 'hello' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(post).toHaveBeenCalledWith({ type: 'send', ...ref, text: 'hello' });
    expect(box.value).toBe('');
  });

  it('keeps Shift+Enter as a new line', () => {
    const post = vi.fn();
    render(<MessageBox threadRef={ref} busy={false} post={post} />);
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', shiftKey: true });
    expect(post).not.toHaveBeenCalled();
  });

  it('lets you send while the agent works, and offers Stop', () => {
    const post = vi.fn();
    render(<MessageBox threadRef={ref} busy={true} post={post} />);
    const box = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(box.disabled).toBe(false);
    fireEvent.change(box, { target: { value: 'and also this' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(post).toHaveBeenCalledWith({ type: 'send', ...ref, text: 'and also this' });
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(post).toHaveBeenCalledWith({ type: 'stop', ...ref });
  });
});
