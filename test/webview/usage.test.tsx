import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsageBar } from '@/webview/UsageBar';
import type { Snapshot } from '@/shared';

afterEach(cleanup);

type Usage = NonNullable<Snapshot['usage']>;
const usage = (over: Partial<Usage> = {}): Usage => ({
  limits: [
    {
      provider: 'Claude',
      at: new Date().toISOString(),
      windows: [{ id: 'five_hour', label: 'Session (5h)', used: 0.6, resetsAt: null }],
    },
  ],
  spent: { session: 0, week: 0 },
  refreshing: false,
  failed: false,
  ...over,
});
const refreshButton = () =>
  screen.getByRole('button', { name: 'Refresh usage' }) as HTMLButtonElement;

describe('UsageBar', () => {
  it('has a refresh button at the end of the title row that asks the host', () => {
    const post = vi.fn();
    render(<UsageBar usage={usage()} post={post} />);
    const row = refreshButton().closest('.usage-title');
    expect(row?.querySelector('h3')?.textContent).toBe('Usage');
    expect(row?.lastElementChild).toBe(refreshButton());
    expect(refreshButton().textContent).toBe('↻');
    fireEvent.click(refreshButton());
    expect(post).toHaveBeenCalledWith({ type: 'refresh-usage' });
  });

  it('spins and is locked while an ask runs', () => {
    const post = vi.fn();
    render(<UsageBar usage={usage({ refreshing: true })} post={post} />);
    expect(refreshButton().disabled).toBe(true);
    expect(refreshButton().className).toContain('spinning');
    fireEvent.click(refreshButton());
    expect(post).not.toHaveBeenCalled();
  });

  it('says when your ask failed, but not while the next one runs', () => {
    const { rerender } = render(<UsageBar usage={usage({ failed: true })} post={vi.fn()} />);
    expect(screen.getByText('Could not refresh. Try again.')).toBeTruthy();
    expect(refreshButton().disabled).toBe(false);
    rerender(<UsageBar usage={usage({ failed: true, refreshing: true })} post={vi.fn()} />);
    expect(screen.queryByText('Could not refresh. Try again.')).toBeNull();
  });

  it('shows no failure line after a good ask', () => {
    render(<UsageBar usage={usage()} post={vi.fn()} />);
    expect(screen.queryByText('Could not refresh. Try again.')).toBeNull();
    expect(refreshButton().className).not.toContain('spinning');
  });

  it('shows the button before any limits are reported', () => {
    render(<UsageBar usage={usage({ limits: [] })} post={vi.fn()} />);
    expect(refreshButton()).toBeTruthy();
  });
});
