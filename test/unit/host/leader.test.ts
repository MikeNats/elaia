import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createLeader } from '@/host/leader';

describe('leader lease', () => {
  it('lets the first window lead and keeps a second one out while the lease is fresh', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'elaia-leader-'));
    const me = createLeader(root);
    me.tick();
    expect(me.isLeader()).toBe(true);
    writeFileSync(path.join(root, 'leader.json'), JSON.stringify({ pid: -1, at: Date.now() }));
    me.tick();
    expect(me.isLeader()).toBe(false);
  });

  it('takes over a lease left by a window that is gone', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'elaia-leader-'));
    writeFileSync(path.join(root, 'leader.json'), JSON.stringify({ pid: -1, at: 0 }));
    const me = createLeader(root);
    me.tick();
    expect(me.isLeader()).toBe(true);
    me.release();
    expect(me.isLeader()).toBe(false);
  });
});
