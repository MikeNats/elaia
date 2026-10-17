import { tmpdir } from 'node:os';
import { parseClaudeLine } from '@/agents';
import { startProcess } from '@/chat';
import { postSnapshot } from './record';
import type { AppState } from './types';

// Your plan's usage only arrives inside a reply. Older than this, Elaia asks for one itself.
const STALE_MS = 10 * 60_000;

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

// Called on the slow timer while the panel is open (asks only when the last report is old), and
// by the refresh button (force: asks now). One ask at a time, and the screen sees it running.
// Only a forced ask that brings no report says so; a failed timer ask waits for the next tick.
export async function refreshLimits(app: AppState, opts: { force?: boolean } = {}): Promise<void> {
  const ask = app.limitsAsk;
  const claude = app.deps.store.limits.all().find((p) => p.provider === 'Claude');
  const age = claude ? Date.parse(app.deps.now()) - Date.parse(claude.at) : Infinity;
  if (ask.running || (!opts.force && age < STALE_MS)) return;
  ask.running = true;
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
    await run.done;
  } finally {
    ask.running = false;
    if (reported) ask.failed = false;
    else if (opts.force) ask.failed = true;
    postSnapshot(app);
  }
}
