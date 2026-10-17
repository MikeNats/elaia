import { threadKey, type ThreadRef } from '@/shared';
import { chatEntry, note, postSnapshot, record } from './record';
import type { AppState, QueuedTurn } from './types';

// You wrote, or Elaia started a turn, while the chat was busy. Its line shows at once and
// waits; it goes to the agent, in order, as soon as the running turn ends.
export function queueIfBusy(app: AppState, ref: ThreadRef, turn: Omit<QueuedTurn, 'ref'>): boolean {
  const key = threadKey(ref);
  // Busy, handing over, or others already waiting: then this one waits too, in order.
  if (!app.turns.isBusy(ref) && !app.handingOver.has(key) && !app.queued.has(key)) return false;
  app.queued.set(key, [...(app.queued.get(key) ?? []), { ...turn, ref }]);
  record(app, ref, [chatEntry(app, 'you', turn.text)]);
  postSnapshot(app);
  return true;
}

// The next waiting turn, taken off the queue.
export function takeQueued(app: AppState, ref: ThreadRef): QueuedTurn | null {
  const key = threadKey(ref);
  const [next, ...rest] = app.queued.get(key) ?? [];
  if (rest.length > 0) app.queued.set(key, rest);
  else app.queued.delete(key);
  // The count on screen goes down at once, even when this turn cannot run.
  if (next) postSnapshot(app);
  return next ?? null;
}

const NOT_SENT = 'Not sent: Elaia closed before it ran. Send it again.';

// VS Code is closing: every waiting turn is dropped, and its chat says so once.
export function dropQueued(app: AppState): void {
  for (const [first] of app.queued.values()) if (first) note(app, first.ref, 'error', NOT_SENT);
  app.queued.clear();
}

export function queuedView(app: AppState): Record<string, number> {
  return Object.fromEntries([...app.queued].map(([key, list]) => [key, list.length]));
}
