import { closeSync, openSync, readSync, statSync } from 'node:fs';
import { parseClaudeLine } from '@/agents';
import type { ProviderLimits, ThreadRef } from '@/shared';
import type { AppState } from './types';

const HOUR = 3_600_000;
const TAIL = 64 * 1024;

// The end of a background run's log: its last lines say what it cost and the plan's limits.
function logTail(log: string): string[] {
  try {
    const size = statSync(log).size;
    const fd = openSync(log, 'r');
    const buffer = Buffer.alloc(Math.min(TAIL, size));
    readSync(fd, buffer, 0, buffer.length, size - buffer.length);
    closeSync(fd);
    return buffer.toString('utf8').split('\n').reverse();
  } catch {
    return [];
  }
}

// A background run's own report: the last result line of its log has its cost and tokens.
function runCost(lines: string[]): { cost: number; tokens: number } | null {
  try {
    const line = lines.find((l) => l.includes('"type":"result"'));
    const result = line ? (JSON.parse(line) as Record<string, unknown>) : null;
    if (!result) return null;
    const u = (result.usage ?? {}) as Record<string, number>;
    const tokens = [
      'input_tokens',
      'output_tokens',
      'cache_read_input_tokens',
      'cache_creation_input_tokens',
    ].reduce((sum, key) => sum + (u[key] ?? 0), 0);
    return { cost: Number(result.total_cost_usd ?? 0), tokens };
  } catch {
    return null;
  }
}

// The run's last limits report. Only Claude's log lines are read today; another provider's
// run reports nothing here until a reader for its output is added.
function runLimits(lines: string[], at: string): ProviderLimits | null {
  for (const line of lines) {
    const found = parseClaudeLine(line).find((e) => e.kind === 'limits');
    if (found?.kind === 'limits') return { provider: found.provider, at, windows: found.windows };
  }
  return null;
}

export function noteRun(app: AppState, ref: ThreadRef, log: string): void {
  const lines = logTail(log);
  const at = app.deps.now();
  const used = runCost(lines);
  if (used) app.deps.store.usage.add({ at, ...ref, ...used, source: 'run' });
  const limits = runLimits(lines, at);
  if (limits) app.deps.store.limits.set(limits);
}

type Spent = { session: number; week: number };
const CACHE_MS = 15_000;
const cache = new WeakMap<AppState, { at: number; spent: Spent }>();
const dropped = new WeakMap<AppState, number>();

// The view needs only the last 7 days, so older rows go. Only the leader window drops them,
// the first time and then at most once an hour: a row another window adds during the
// rewrite can be lost, so the rewrite stays rare.
function dropOld(app: AppState, weekAgo: string): void {
  const last = dropped.get(app);
  if (!app.deps.isLeader() || (last !== undefined && Date.now() - last < HOUR)) return;
  dropped.set(app, Date.now());
  try {
    app.deps.store.usage.drop(weekAgo);
  } catch {
    // A full or read-only disk: the view still reads the rows, and the next hour tries again.
  }
}

// What Elaia itself spent (dollars at API prices) in the last 5 hours and 7 days. Screen
// updates come often; its log is read at most every 15 seconds.
function spent(app: AppState): Spent {
  const hit = cache.get(app);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.spent;
  const now = Date.parse(app.deps.now());
  const weekAgo = new Date(now - 7 * 24 * HOUR).toISOString();
  dropOld(app, weekAgo);
  const rows = app.deps.store.usage.since(weekAgo);
  const recent = new Date(now - 5 * HOUR).toISOString();
  const sum = (from: string) => rows.filter((r) => r.at >= from).reduce((s, r) => s + r.cost, 0);
  const value = { session: sum(recent), week: sum('') };
  cache.set(app, { at: Date.now(), spent: value });
  return value;
}

// The usage bar: your plan's limits as each provider last reported them (read fresh, so the
// bar moves the moment a turn or run ends), Elaia's own spend for the hover, and the state of
// the ask for new numbers (running now; your last button ask failed).
export function usageView(app: AppState): {
  limits: ProviderLimits[];
  spent: Spent;
  refreshing: boolean;
  failed: boolean;
} {
  const { running, failed } = app.limitsAsk;
  return { limits: app.deps.store.limits.all(), spent: spent(app), refreshing: running, failed };
}
