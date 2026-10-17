import { threadKey, type ThreadRef } from '@/shared';
import { freshSince, noteAttention } from './attention';
import { postSnapshot } from './record';
import { threadPage } from './ticketIntro';
import type { AppState } from './types';

// Files in the store every window shares changed. Lines another window wrote show here too:
// the open thread is posted again and the dots move. Nothing here writes a thread file.
export function storeChanged(app: AppState, paths: string[]): void {
  const projects = [...app.projects.keys()];
  let dots = false;
  for (const p of paths) {
    const ref = app.deps.store.threads.refOf(p, projects);
    if (ref && threadChanged(app, ref)) dots = true;
  }
  if (paths.includes('seen.json') && recheckDots(app)) dots = true;
  if (dots) postSnapshot(app);
}

// Lines this window has not seen yet: the dot moves on (the rule the leader uses), and an
// opened thread is posted whole. Returns true when the dot may have changed.
function threadChanged(app: AppState, ref: ThreadRef): boolean {
  const key = threadKey(ref);
  const all = app.deps.store.threads.read(ref);
  const known = app.known.get(key) ?? 0;
  // This window wrote these lines itself and showed them already.
  if (all.length === known) return false;
  app.known.set(key, all.length);
  const dot = noteAttention(app, ref, all.slice(known));
  if (app.opened.has(key)) app.deps.post({ type: 'thread', ref, entries: threadPage(app, ref) });
  return dot;
}

// seen.json changed: you read a thread to its bottom in some window, so its dot may be gone.
// This never writes seen.json, so it cannot start a loop of changes. True when a dot may differ.
function recheckDots(app: AppState): boolean {
  const { store } = app.deps;
  let changed = false;
  for (const project of app.projects.keys()) {
    for (const thread of store.threads.list(project)) {
      const ref = { project, thread };
      const key = threadKey(ref);
      const a = app.attention.get(key);
      if (!a?.fresh || freshSince(store.threads.read(ref), store.seen.get(ref) ?? '')) continue;
      app.attention.set(key, { ...a, fresh: false });
      changed = true;
    }
  }
  // A "waiting" dot is compared with seen.json in every snapshot, so a snapshot is enough.
  return changed || [...app.attention.values()].some((a) => a.waitingAt !== null);
}
