import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { watchFolder } from '@/track';

describe('watchFolder', () => {
  it('calls back after changes settle', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'elaia-watch-'));
    mkdirSync(path.join(dir, 'tickets', 't1'), { recursive: true });
    const onChange = vi.fn();
    const stop = watchFolder(dir, onChange, { settleMs: 50 });
    // macOS can miss writes made right as a watch starts, so write again until it reacts.
    await vi.waitFor(
      () => {
        writeFileSync(path.join(dir, 'tickets', 't1', 'stages'), `${Date.now()}\n`);
        expect(onChange).toHaveBeenCalled();
      },
      { timeout: 5000, interval: 200 },
    );
    stop();
  });

  it('ignores paths that do not matter', async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'elaia-watch-'));
    const onChange = vi.fn();
    const relevant = vi.fn((p: string) => p.endsWith('stages'));
    const stop = watchFolder(dir, onChange, { settleMs: 20, relevant });
    await vi.waitFor(
      () => {
        writeFileSync(path.join(dir, 'log'), `${Date.now()}`);
        writeFileSync(path.join(dir, 'stages'), `${Date.now()}`);
        // macOS may report one file per round, so wait until both were seen.
        expect(relevant).toHaveBeenCalledWith('log');
        expect(onChange).toHaveBeenCalled();
      },
      { timeout: 8000, interval: 200 },
    );
    stop();
    const logCall = relevant.mock.calls.findIndex((call) => call[0] === 'log');
    expect(relevant.mock.results[logCall]?.value).toBe(false);
  });

  it('does nothing for a folder that does not exist yet', () => {
    const stop = watchFolder('/no/such/folder', vi.fn(), { settleMs: 50 });
    expect(() => stop()).not.toThrow();
  });
});
