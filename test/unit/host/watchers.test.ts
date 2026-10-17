import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { App } from '@/app';
import { createWatchers } from '@/host/watchers';

describe('store watcher', () => {
  it('tells the app which thread file or seen.json changed, and nothing else (AC-10)', async () => {
    const root = mkdtempSync(path.join(tmpdir(), 'elaia-store-watch-'));
    mkdirSync(path.join(root, 'threads', 'elaia-1a2b3c4d'), { recursive: true });
    const storeChanged = vi.fn();
    // Only what createWatchers uses before its 60-second timer: the store root.
    const app = { store: { root }, storeChanged } as unknown as App;
    const watchers = createWatchers(app, () => undefined);
    const file = 'threads/elaia-1a2b3c4d/T.jsonl';
    const seenPaths = () => storeChanged.mock.calls.flatMap((call) => call[0] as string[]);
    await vi.waitFor(
      () => {
        appendFileSync(path.join(root, file), '{}\n');
        writeFileSync(path.join(root, 'seen.json'), '{}\n');
        writeFileSync(path.join(root, 'usage.jsonl'), '{}\n');
        // macOS may report one file per round, so wait until both were seen.
        expect(seenPaths()).toEqual(expect.arrayContaining([file, 'seen.json']));
      },
      // Slower than the watcher's 300 ms settle time, or each round would put it off again.
      { timeout: 8000, interval: 500 },
    );
    watchers.dispose();
    expect(seenPaths()).not.toContain('usage.jsonl');
  });
});
