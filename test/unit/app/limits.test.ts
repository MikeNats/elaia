import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, type Settings } from '@/app';
import { createStore } from '@/store';
import { ToHostSchema, type ToWebview } from '@/shared';
import { FAKE_GLAFKA } from '../../support/fakeGlafka';
import { FAKE_CLAUDE, fakeClaude } from '../../support/fakeClaude';

const NOW = '2026-10-13T10:00:00Z';
let posted: ToWebview[];
let settings: Settings;
let clock: string;

function app() {
  const myPosts = posted;
  return createApp({
    store: createStore(mkdtempSync(path.join(tmpdir(), 'elaia-limits-store-'))),
    settings: () => settings,
    post: (m) => myPosts.push(m),
    notify: () => undefined,
    isLeader: () => true,
    now: () => clock,
  });
}

// The usage part of every snapshot posted, oldest first.
const usages = () =>
  posted.flatMap((m) => (m.type === 'snapshot' && m.snapshot.usage ? [m.snapshot.usage] : []));
const lastUsage = () => usages().at(-1);

// Waits in real time until the fake has started and read its prompt. setImmediate is not faked.
async function started(claude: { calls(): unknown[] }): Promise<void> {
  while (claude.calls().length === 0) await new Promise((r) => setImmediate(r));
}

// A report from a minute ago: fresh, so the timer alone would not ask again.
const FRESH = {
  provider: 'Claude',
  at: '2026-10-13T09:59:00Z',
  windows: [{ id: 'five_hour', label: 'Session (5h)', used: 0.1, resetsAt: null }],
};

beforeEach(() => {
  clock = NOW;
  posted = [];
  settings = {
    workflow: 'glafka',
    glafkaPath: FAKE_GLAFKA,
    platform: 'claude',
    agent: 'claude',
    claudePath: FAKE_CLAUDE,
    agentCommand: '',
    permissionMode: 'acceptEdits',
    allowedTools: [],
    autoAdvance: true,
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('usage refresh', { timeout: 30_000 }, () => {
  it('accepts the refresh-usage message from the webview', () => {
    expect(ToHostSchema.safeParse({ type: 'refresh-usage' }).success).toBe(true);
  });

  it('asks Claude even when the numbers are fresh, spinning while it asks', async () => {
    const claude = fakeClaude('limits');
    const a = app();
    a.store.limits.set(FRESH);
    await a.refreshUsage();
    expect(claude.calls()).toHaveLength(1);
    expect(usages().map((u) => u.refreshing)).toEqual([true, false]);
    expect(lastUsage()?.failed).toBe(false);
    expect(lastUsage()?.limits[0]?.at).toBe(NOW);
    expect(lastUsage()?.limits[0]?.windows[0]?.used).toBe(0.42);
  });

  it('says so when your ask fails, and clears it when the next one works', async () => {
    fakeClaude('limits').fail();
    const a = app();
    await a.refreshUsage();
    expect(lastUsage()).toMatchObject({ refreshing: false, failed: true });
    fakeClaude('limits');
    await a.refreshUsage();
    expect(lastUsage()).toMatchObject({ refreshing: false, failed: false });
  });

  it('says so when Claude is not where the settings point', async () => {
    fakeClaude('limits');
    settings = { ...settings, claudePath: path.join(tmpdir(), 'elaia-no-such-claude') };
    const a = app();
    await a.refreshUsage();
    expect(lastUsage()).toMatchObject({ refreshing: false, failed: true });
  });

  it('counts a reply with no limits report as a failed ask', async () => {
    fakeClaude('turn');
    const a = app();
    await a.refreshUsage();
    expect(lastUsage()?.failed).toBe(true);
  });

  it('keeps a failed timer ask silent', async () => {
    fakeClaude('limits').fail();
    const a = app();
    // No report yet, so the timer's ask runs.
    await a.refreshLimits();
    expect(lastUsage()).toMatchObject({ refreshing: false, failed: false });
  });

  it('runs one ask at a time: a click while the timer asks starts nothing', async () => {
    const claude = fakeClaude('limits');
    const a = app();
    await Promise.all([a.refreshLimits(), a.refreshUsage()]);
    expect(claude.calls()).toHaveLength(1);
  });

  it('still skips a timer ask when the numbers are fresh', async () => {
    const claude = fakeClaude('limits');
    const a = app();
    a.store.limits.set(FRESH);
    await a.refreshLimits();
    expect(claude.calls()).toHaveLength(0);
  });

  it('asks once in 10 minutes when no report ever comes back', async () => {
    const claude = fakeClaude('turn');
    const a = app();
    await a.refreshLimits();
    await a.refreshLimits();
    expect(claude.calls()).toHaveLength(1);
    clock = '2026-10-13T10:09:59Z';
    await a.refreshLimits();
    expect(claude.calls()).toHaveLength(1);
    clock = '2026-10-13T10:10:00Z';
    await a.refreshLimits();
    expect(claude.calls()).toHaveLength(2);
  });

  it('makes the timer wait 10 minutes after you click refresh', async () => {
    const claude = fakeClaude('turn');
    const a = app();
    await a.refreshUsage();
    await a.refreshLimits();
    expect(claude.calls()).toHaveLength(1);
  });

  it('never asks on the timer when the agent is not Claude', async () => {
    const claude = fakeClaude('limits');
    settings = { ...settings, agent: 'command' };
    const a = app();
    await a.refreshLimits();
    expect(claude.calls()).toHaveLength(0);
  });

  it('still asks at once when you click refresh with another agent', async () => {
    const claude = fakeClaude('limits');
    settings = { ...settings, agent: 'command' };
    const a = app();
    await a.refreshUsage();
    expect(claude.calls()).toHaveLength(1);
  });

  it('stops a refresh that hangs after 30 seconds, says it failed, and can ask again', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const claude = fakeClaude('limits');
    claude.hang();
    const a = app();
    const asking = a.refreshUsage();
    await started(claude);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(lastUsage()?.refreshing).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    await asking;
    expect(lastUsage()).toMatchObject({ refreshing: false, failed: true });
    fakeClaude('limits');
    await a.refreshUsage();
    expect(lastUsage()).toMatchObject({ refreshing: false, failed: false });
  });

  it('stops a timer ask that hangs, and stays silent', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const claude = fakeClaude('limits');
    claude.hang();
    const a = app();
    const asking = a.refreshLimits();
    await started(claude);
    await vi.advanceTimersByTimeAsync(30_000);
    await asking;
    expect(lastUsage()).toMatchObject({ refreshing: false, failed: false });
  });
});
