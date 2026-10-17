import { diffTicket } from '@/track';
import type { ThreadRef, TicketView } from '@/shared';
import { keepNow } from './keep';
import { record, workflowOf } from './record';
import type { AppState } from './types';

// A ticket left the open list: it was closed or cancelled. Say so, then publish its thread.
export async function closeTicket(
  app: AppState,
  projectPath: string,
  old: TicketView,
): Promise<void> {
  const ref = { project: projectPath, thread: old.id };
  const now = await workflowOf(app, projectPath)
    .ticket(projectPath, old.id)
    .catch(() => null);
  record(app, ref, diffTicket(old, now ?? { ...old, closed: true }, app.deps.now()));
  publishThread(app, ref);
}

// The last write of a closed ticket's chat into the repo's .elaia/chats/. Never a worktree.
export function publishThread(app: AppState, ref: ThreadRef): string | null {
  const { store } = app.deps;
  if (store.published.has(ref)) return null;
  const file = keepNow(app, ref);
  store.published.mark(ref);
  return file;
}
