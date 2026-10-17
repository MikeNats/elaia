import { threadKey, type Attention, type ThreadEntry, type ThreadRef } from '@/shared';
import type { AppState } from './types';

// A dot means "something here you have not seen". Opening the chat and reaching its bottom
// clears it, even a question you have not answered yet (his rule).

const ASKS = new Set<ThreadEntry['kind']>(['question', 'approval', 'needs-you']);
// A ticket's card copied into its epic chat is answered in the ticket, so it never waits here.
const isCopy = (e: ThreadEntry) =>
  (e.actions ?? []).length > 0 && (e.actions ?? []).every((a) => a.thread || a.kind === 'open');
const asks = (e: ThreadEntry) => e.shown && ASKS.has(e.kind) && !isCopy(e);

export interface ThreadAttention {
  // The time of a question or approval with no answer from you after it; null when none.
  waitingAt: string | null;
  // Something new since you last saw the bottom of the thread.
  fresh: boolean;
}

const NOTHING: ThreadAttention = { waitingAt: null, fresh: false };

// Moves a thread's attention on by some new entries. `seenNow`: you are looking at its bottom.
function step(state: ThreadAttention, entries: ThreadEntry[], seenNow: boolean): ThreadAttention {
  let { waitingAt, fresh } = state;
  for (const e of entries) {
    if (e.kind === 'you') waitingAt = null;
    else if (asks(e)) waitingAt = e.at;
    if (e.shown && e.kind !== 'you' && !seenNow) fresh = true;
  }
  return { waitingAt, fresh };
}

// Something you have not seen: a shown line, not yours, after the time you last saw the thread.
export const freshSince = (entries: ThreadEntry[], seen: string): boolean =>
  entries.some((e) => e.shown && e.kind !== 'you' && e.at > seen);

// Once at start: every kept thread, against when you last saw it. The first run sees all.
export function loadAttention(app: AppState): void {
  const { store, now } = app.deps;
  const first = !store.seen.exists();
  for (const project of app.projects.keys()) {
    const refs = store.threads.list(project).map((thread) => ({ project, thread }));
    if (first) store.seen.mark(refs, now());
    for (const ref of refs) {
      const seen = store.seen.get(ref) ?? '';
      const entries = store.threads.read(ref);
      const { waitingAt } = step(NOTHING, entries, true);
      const fresh = freshSince(entries, seen);
      app.attention.set(threadKey(ref), { waitingAt, fresh });
      // What this window has seen of the file: only lines after these are new to it.
      app.known.set(threadKey(ref), entries.length);
    }
  }
}

// New entries kept. Returns true when the thread's dot may have changed.
export function noteAttention(app: AppState, ref: ThreadRef, entries: ThreadEntry[]): boolean {
  const key = threadKey(ref);
  const seenNow = app.viewing === key;
  const before = app.attention.get(key) ?? NOTHING;
  const after = step(before, entries, seenNow);
  if (seenNow) app.deps.store.seen.mark([ref], app.deps.now());
  app.attention.set(key, after);
  return before.waitingAt !== after.waitingAt || before.fresh !== after.fresh;
}

// The thread is on screen and scrolled to the bottom (or not any more). At the bottom you
// have seen everything in it. Returns true when its dot went away.
export function setViewing(app: AppState, ref: ThreadRef | null, atBottom: boolean): boolean {
  const key = ref && atBottom ? threadKey(ref) : null;
  app.viewing = key;
  if (!ref || !key) return false;
  app.deps.store.seen.mark([ref], app.deps.now());
  const before = app.attention.get(key);
  if (!before) return false;
  app.attention.set(key, { ...before, fresh: false });
  return before.fresh || before.waitingAt !== null;
}

// For the tree: one dot per thread with something unseen. "waiting" when that includes a
// question for you (the tooltip says so, and an epic shows it for its tickets).
export function attentionView(app: AppState): Record<string, Attention> {
  const view: Record<string, Attention> = {};
  const seen = app.deps.store.seen.all();
  for (const [key, a] of app.attention) {
    if (a.waitingAt && a.waitingAt > (seen[key] ?? '')) view[key] = 'waiting';
    else if (a.fresh) view[key] = 'new';
  }
  return view;
}
