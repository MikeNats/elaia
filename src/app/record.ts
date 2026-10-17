import { modelsFor } from '@/agents';
import { guarded, workflowFor } from '@/workflow';
import type { Snapshot, ThreadEntry, ThreadRef } from '@/shared';
import { copiesForEpic } from './epicMirror';
import { keepSoon } from './keep';
import { knowWritten } from './known';
import { attentionView, noteAttention } from './attention';
import { liveView, withLiveTokens } from './liveAgents';
import { queuedView } from './queue';
import { trustedNow } from './repoTrust';
import { usageView } from './usage';
import type { AppState } from './types';

// The project's tool. Commands that can run the repo's own commands wait for your Trust.
export const workflowOf = (app: AppState, project: string) =>
  guarded(workflowFor(project, app.deps.settings()), () => trustedNow(app, project));

// Keep entries in the thread and show them live.
export function record(app: AppState, ref: ThreadRef, entries: ThreadEntry[]): void {
  if (entries.length === 0) return;
  app.deps.store.threads.append(ref, entries);
  showKept(app, ref, entries);
}

// Entries just kept: show them, write the chat into the repo's .elaia/ (git ignores it),
// and copy what waits for you into the epic chat.
export function showKept(app: AppState, ref: ThreadRef, entries: ThreadEntry[]): void {
  knowWritten(app, ref, entries.length);
  app.deps.post({ type: 'entries', ref, entries });
  keepSoon(app, ref);
  if (noteAttention(app, ref, entries)) postSnapshot(app);
  const epic = copiesForEpic(ref, entries);
  if (epic) record(app, epic.epicRef, epic.copies);
}

// glafka entries that mean "your move" also become a VS Code notification.
export function notifyIfNeeded(app: AppState, ref: ThreadRef, entries: ThreadEntry[]): void {
  for (const e of entries) {
    if (e.source === 'glafka' && (e.kind === 'needs-you' || e.kind === 'approval')) {
      app.deps.notify(`${ref.thread}: ${e.text}`, ref);
    }
  }
}

export function note(app: AppState, ref: ThreadRef, kind: ThreadEntry['kind'], text: string): void {
  record(app, ref, [{ at: app.deps.now(), kind, text, shown: true, source: 'glafka' }]);
}

export function snapshot(app: AppState): Snapshot {
  const agentName = app.deps.settings().agent === 'claude' ? 'Claude' : 'Agent';
  return {
    projects: [...app.projects.values()].map((p) => withLiveTokens(app, p)),
    agentName,
    busy: app.turns.busyKeys(),
    attention: attentionView(app),
    permissions: app.deps.settings().permissions ?? 'auto',
    agents: liveView(app),
    queued: queuedView(app),
    models: modelsFor(app.deps.settings().agent),
    chosenModels: app.deps.store.models.all(),
    usage: usageView(app),
  };
}

export function postSnapshot(app: AppState): void {
  app.deps.post({ type: 'snapshot', snapshot: snapshot(app) });
}

// A line the chat itself says (a note, an error), shown in the thread.
export const chatEntry = (app: AppState, kind: ThreadEntry['kind'], text: string): ThreadEntry => ({
  at: app.deps.now(),
  kind,
  text,
  shown: true,
  source: 'chat',
});

export const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));
