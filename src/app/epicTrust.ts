import { allMerged, planHash, readEpic, readEpics, type Epic, type EpicRead } from '@/epics';
import type { AppState } from './types';

// The file says what to build; only Elaia's store says you approved it. A `status` or
// `approval` written into epic.json by hand, by an agent or by a commit counts for nothing.
export function trusted(app: AppState, project: string, slug: string, epic: Epic): Epic {
  const saved = app.deps.store.approvals.get(project, slug);
  if (!saved || saved.plan !== planHash(epic))
    return { ...epic, status: 'proposed', approval: null };
  return { ...epic, status: allMerged(epic) ? 'done' : 'approved', approval: saved.approval };
}

// You approved this epic once, and its plan changed since.
export function changedSinceApproved(
  app: AppState,
  project: string,
  slug: string,
  epic: Epic,
): boolean {
  const saved = app.deps.store.approvals.get(project, slug);
  return saved !== null && saved.plan !== planHash(epic);
}

const trustedRead = (app: AppState, project: string, read: EpicRead): EpicRead =>
  read.epic ? { ...read, epic: trusted(app, project, read.slug, read.epic) } : read;

export const trustedEpics = (app: AppState, project: string): EpicRead[] =>
  readEpics(project).map((read) => trustedRead(app, project, read));

export const trustedEpic = (app: AppState, project: string, slug: string): Epic | null =>
  trustedRead(app, project, readEpic(project, slug)).epic;
