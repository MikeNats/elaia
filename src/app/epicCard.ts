import type { Epic } from '@/epics';
import { epicThread, PROJECT_THREAD, type EpicView, type ThreadEntry } from '@/shared';
import { changedSinceApproved, trustedEpics } from './epicTrust';
import { startPlanning } from './epicPlan';
import { record } from './record';
import type { AppState } from './types';

// Every ticket closed (merged or cancelled): the epic leaves the tree. Its file and chats stay.
const allClosed = (epic: Epic) =>
  epic.tickets.length > 0 &&
  epic.tickets.every((t) => t.state === 'merged' || t.state === 'cancelled');

export function epicViews(app: AppState, project: string): EpicView[] {
  return trustedEpics(app, project).flatMap(({ slug, epic }) =>
    epic && !allClosed(epic)
      ? [{ slug, title: epic.title, status: epic.status, tickets: epic.tickets }]
      : [],
  );
}

function cutText(slug: string, epic: Epic, changed: boolean): string {
  const number = new Map(epic.tickets.map((t, i) => [t.key, i + 1]));
  const after = (deps: string[]) =>
    deps.length > 0 ? ` (after ${deps.map((k) => number.get(k)).join(', ')})` : '';
  return [
    `**Epic: ${epic.title}** — ${epic.tickets.length} tickets`,
    epic.goal,
    '',
    ...epic.tickets.map((t, i) => `${i + 1}. ${t.title}${after(t.dependsOn)}`),
    '',
    epic.ordered ? 'Runs in your order, one after another.' : 'Runs in parallel where it can.',
    `File: \`docs/elaia/epics/${slug}/epic.json\``,
    ...(changed ? ['', 'The plan changed after you approved it. Approve it again to go on.'] : []),
  ].join('\n');
}

// The first cut of an epic: say so in the main chat and open the epic's own chat.
function announce(app: AppState, project: string, slug: string, title: string): void {
  const text = `Epic "${title}" is ready. Continue in its own chat: approve or change it there.`;
  const open = { kind: 'open' as const, label: 'Open epic chat', value: epicThread(slug) };
  record(app, { project, thread: PROJECT_THREAD }, [
    { at: app.deps.now(), kind: 'progress', text, shown: true, source: 'chat', actions: [open] },
  ]);
  app.deps.post({ type: 'focus', ref: { project, thread: epicThread(slug) } });
}

// After the planner writes an epic: show its cut once in the epic's chat, or say what is wrong.
export function offerCuts(app: AppState, project: string): void {
  const main = { project, thread: PROJECT_THREAD };
  const mainSeen = new Set(app.deps.store.threads.read(main).map((e) => e.text));
  const at = app.deps.now();
  for (const { slug, epic, problem } of trustedEpics(app, project)) {
    if (problem) {
      const text = `The epic file docs/elaia/epics/${slug}/epic.json is not valid: ${problem}. Ask me to fix it.`;
      if (!mainSeen.has(text))
        record(app, main, [{ at, kind: 'error', text, shown: true, source: 'chat' }]);
      continue;
    }
    if (epic?.status !== 'proposed') continue;
    const ref = { project, thread: epicThread(slug) };
    const shown = app.deps.store.threads.read(ref);
    if (epic.tickets.length === 0) {
      if (shown.length === 0) startPlanning(app, project, slug, epic);
      continue;
    }
    const text = cutText(slug, epic, changedSinceApproved(app, project, slug, epic));
    if (shown.some((e) => e.text === text)) continue;
    const card: ThreadEntry = {
      at,
      kind: 'approval',
      text,
      shown: true,
      source: 'chat',
      actions: [
        { kind: 'approve-epic', label: 'Approve: whole epic', value: slug },
        { kind: 'approve-tickets', label: 'Approve: ticket by ticket', value: slug },
        { kind: 'reply', label: 'Change', value: `I want to change the epic "${epic.title}".` },
      ],
    };
    record(app, ref, [card]);
    if (shown.length === 0) announce(app, project, slug, epic.title);
  }
}
