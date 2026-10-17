import { tmpdir } from 'node:os';
import { parseClaudeLine } from '@/agents';
import { startProcess } from '@/chat';
import { postSnapshot } from './record';
import type { AppState } from './types';

// Your plan's usage only arrives inside a reply. Older than this, Elaia asks for one itself.
const STALE_MS = 10 * 60_000;

// A claude that hangs is stopped after this, so the spinner never turns for ever.
const ASK_TIMEOUT_MS = 30_000;

// The smallest reply that still carries the report: Haiku, one word, no tools, no project files,
// no personal setup. About $0.0007. Only Claude reports its limits today.
const ASK = [
  '-p',
  '--model',
  'haiku',
  '--output-format',
  'stream-json',
  '--verbose',
  '--setting-sources',
  'project,local',
  '--strict-mcp-config',
  '--disable-slash-commands',
  '--tools',
  '',
];

// Called on the slow timer while the panel is open, and by the refresh button (force: asks now).
// The timer asks only when Claude is your agent and both the last report and the last ask are
// old: an ask that brings no report (an API key login, an older claude) still counts, or the
// timer would ask on every tick. One ask at a time, and the screen sees it running.
// Only a forced ask that brings no report says so; a failed timer ask waits for the next tick.
export async function refreshLimits(app: AppState, opts: { force?: boolean } = {}): Promise<void> {
  const ask = app.limitsAsk;
  const now = Date.parse(app.deps.now());
  const claude = app.deps.store.limits.all().find((p) => p.provider === 'Claude');
  const last = Math.max(claude ? Date.parse(claude.at) : -Infinity, ask.lastAt ?? -Infinity);
  const timerSkips = app.deps.settings().agent !== 'claude' || now - last < STALE_MS;
  if (ask.running || (!opts.force && timerSkips)) return;
  ask.running = true;
  ask.lastAt = now;
  postSnapshot(app);
  let reported = false;
  try {
    const run = startProcess({
      command: app.deps.settings().claudePath,
      args: ASK,
      cwd: tmpdir(),
      input: 'ok',
      onLine(line) {
        for (const event of parseClaudeLine(line)) {
          if (event.kind !== 'limits') continue;
          reported = true;
          const report = { provider: event.provider, at: app.deps.now(), windows: event.windows };
          app.deps.store.limits.set(report);
        }
      },
    });
    // stop() ends the whole process group, so no stuck claude stays behind.
    const timer = setTimeout(() => run.stop(), ASK_TIMEOUT_MS);
    await run.done;
    clearTimeout(timer);
  } finally {
    ask.running = false;
    if (reported) ask.failed = false;
    else if (opts.force) ask.failed = true;
    postSnapshot(app);
  }
}
