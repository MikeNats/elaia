import path from 'node:path';
import { handOffNewTickets, type TurnStart } from './ticketHandOff';
import { PROJECT_THREAD, type ThreadEntry, type ThreadRef } from '@/shared';
import type { SetupItem } from '@/workflow';
import { note, record, workflowOf } from './record';
import { refresh } from './refresh';
import { nextSetup, projectRef } from './setupCards';
import { runSetup, setupStep } from './setupRun';
import type { AppState } from './types';

const mark = (item: SetupItem) => (item.done ? '✅' : item.optional ? '⚪' : '❌');

function card(app: AppState, project: string, items: SetupItem[]): ThreadEntry {
  const name = workflowOf(app, project).name;
  const lines = items.map(
    (i) => `- ${mark(i)} ${i.label}${i.optional && !i.done ? ' (optional)' : ''}`,
  );
  return {
    at: app.deps.now(),
    kind: 'approval',
    text: [`**Set up ${path.basename(project)} for ${name}**`, '', ...lines].join('\n'),
    shown: true,
    source: 'glafka',
    actions: [
      { kind: 'setup', label: 'Set up', value: project },
      { kind: 'skip-setup', label: 'Skip', value: project },
    ],
  };
}

// The setup card in the project chat, while something is still missing. Checked from
// files only; nothing runs until you press Set up. Shown again only when it changed.
export function offerSetup(app: AppState, project: string): void {
  if (app.setupAnswered.has(project)) return;
  const items = workflowOf(app, project).setupStatus(project);
  if (items.every((i) => i.done || i.optional)) return;
  const ref = { project, thread: PROJECT_THREAD };
  const next = card(app, project, items);
  // Only cards since the last Clear count: one hidden by Clear is not on your screen.
  const thread = app.deps.store.threads.read(ref);
  const shown = thread.slice(thread.findLastIndex((e) => e.kind === 'cleared') + 1);
  const cards = shown.filter((e) => e.actions?.some((a) => a.kind === 'setup'));
  if (cards.at(-1)?.text === next.text) return;
  record(app, ref, [next]);
}

export function skipSetup(app: AppState, project: string): void {
  app.setupAnswered.add(project);
  const ref = projectRef(project);
  record(app, ref, [
    { at: app.deps.now(), kind: 'you', text: 'Skip', shown: true, source: 'chat' },
  ]);
  note(app, ref, 'progress', 'Setup skipped. Elaia asks again next time it starts.');
}

export const setupActions = (app: AppState) => ({
  setup: (p: string) => runSetup(app, p),
  setupStep: (p: string, key: string, choice: string) => setupStep(app, p, key, choice),
  skipSetup: (p: string) => skipSetup(app, p),
});

// After a chat turn: pick up what the agent changed. In the project chat, setup goes on if it
// is under way, with no new chat turn from here.
export async function afterTurn(app: AppState, ref: ThreadRef, turn: TurnStart): Promise<void> {
  await refresh(app, ref.project);
  // A ticket the main chat just made is planned in its own chat, not here.
  if (ref.thread === PROJECT_THREAD) handOffNewTickets(app, ref.project, turn);
  const steps = app.setupSteps.get(ref.project);
  if (ref.thread === PROJECT_THREAD && steps && !steps.has('complete'))
    await nextSetup(app, ref.project, false);
}
