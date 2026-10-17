import { threadKey, type ThreadRef } from '@/shared';
import { noteAttention } from './attention';
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
