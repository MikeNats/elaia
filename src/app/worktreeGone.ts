import { existsSync } from 'node:fs';
import path from 'node:path';
import { threadKey, type ThreadEntry, type TicketView } from '@/shared';
import { notifyIfNeeded, record } from './record';
import type { AppState } from './types';

const GONE = 'The worktree folder is gone, but the ticket is still open. Is the work merged?';

// Tickets whose folder was missing on the last refresh, by thread key, per app.
const goneOnce = new WeakMap<AppState, Set<string>>();

// A worktree deleted by hand, not by the tool, leaves its ticket open for ever.
// Gone on two refreshes in a row, so a close still running is not caught half-way.
export function offerGoneWorktrees(app: AppState, project: string, tickets: TicketView[]): void {
  const seen = goneOnce.get(app) ?? new Set<string>();
  goneOnce.set(app, seen);
  for (const t of tickets) {
    const ref = { project, thread: t.id };
    const key = threadKey(ref);
    if (!t.worktree || existsSync(path.resolve(project, t.worktree))) {
      seen.delete(key);
      continue;
    }
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }
    if (app.deps.store.threads.read(ref).some((e) => e.text === GONE)) continue;
    const card: ThreadEntry = {
      at: app.deps.now(),
      kind: 'approval',
      text: GONE,
      shown: true,
      source: 'glafka',
      actions: [
        { kind: 'close', label: 'Yes: Close ticket', value: t.id },
        { kind: 'cancel', label: 'No: Cancel ticket', value: t.id },
      ],
    };
    record(app, ref, [card]);
    notifyIfNeeded(app, ref, [card]);
  }
}
