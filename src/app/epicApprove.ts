import { planHash, readEpic, updateEpic, type Approval } from '@/epics';
import { epicThread } from '@/shared';
import { trusted } from './epicTrust';
import { note, record } from './record';
import { refresh } from './refresh';
import type { AppState } from './types';

export async function approveEpic(
  app: AppState,
  project: string,
  slug: string,
  approval: Approval,
): Promise<void> {
  const ref = { project, thread: epicThread(slug) };
  const epic = readEpic(project, slug).epic;
  if (!epic) return note(app, ref, 'error', `Epic "${slug}" was not found or is not valid.`);
  if (trusted(app, project, slug, epic).status !== 'proposed')
    return note(app, ref, 'progress', `Epic "${epic.title}" is already approved.`);
  // The store holds the approval; the file only shows it to people and the planner.
  app.deps.store.approvals.set(project, slug, {
    approval,
    plan: planHash(epic),
    at: app.deps.now(),
  });
  updateEpic(project, slug, (e) => ({ ...e, status: 'approved', approval }));
  const said = approval === 'epic' ? 'Approve: whole epic' : 'Approve: ticket by ticket';
  record(app, ref, [{ at: app.deps.now(), kind: 'you', text: said, shown: true, source: 'chat' }]);
  const how = approval === 'epic' ? 'whole epic' : 'ticket by ticket';
  const where = app.deps.isLeader()
    ? 'Starting the tickets that are ready.'
    : 'Your other Elaia window starts the tickets that are ready, within a minute.';
  note(app, ref, 'progress', `Epic "${epic.title}" approved (${how}). ${where}`);
  // Through refresh: one run per project at a time, and only in the window that runs epics.
  await refresh(app, project);
}
