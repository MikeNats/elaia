import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { threadKey, type ThreadEntry, type TicketView } from '@/shared';
import { chatEntry, record, workflowOf } from './record';
import { plannerOf, startTicket } from './ticketStart';
import type { AppState } from './types';

// When the plan file was last written, or null when there is none yet.
function planTime(file: string): number | null {
  try {
    const stat = statSync(file);
    return stat.size > 0 ? stat.mtimeMs : null;
  } catch {
    return null;
  }
}

// The plan's goal and how many tasks it has, from glafka's plan layout.
function planFacts(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const goal = /^\*\*Goal:\*\*\s*(.+)$/m.exec(text)?.[1]?.trim();
  const tasks = (text.match(/^## Task\b/gm) ?? []).length;
  return [
    ...(goal ? [`- Goal: ${goal}`] : []),
    ...(tasks > 0 ? [`- ${tasks} task${tasks === 1 ? '' : 's'}`] : []),
  ];
}

// The time in the text makes a changed plan a new card.
function planCard(
  app: AppState,
  t: TicketView,
  file: string,
  full: string,
  at: number,
): ThreadEntry {
  const title = t.title ?? t.id;
  const written = new Date(at).toTimeString().slice(0, 5);
  return {
    ...chatEntry(app, 'approval', ''),
    text: [
      `**Plan ready: ${title}**`,
      '',
      ...planFacts(full),
      `- Plan: \`${file}\` (written ${written})`,
      '',
      'Start the coder? The ticket gets its own worktree and its own chat.',
    ].join('\n'),
    actions: [
      { kind: 'start', label: 'Start the coder', value: t.id },
      { kind: 'reply', label: 'Change it', value: `I want to change the plan of "${title}".` },
    ],
  };
}

// After a planning turn: a ticket with its spec and plan written but no worktree yet gets a
// Start card in the chat that planned it. An epic approved as a whole starts it at once.
export function offerPlans(app: AppState, project: string, tickets: TicketView[]): void {
  const workflow = workflowOf(app, project);
  for (const t of tickets) {
    if (t.planned || t.closed || !t.specPath) continue;
    const file = workflow.planFile(t.id);
    const full = path.join(project, file);
    const at = planTime(full);
    if (at === null) continue;
    const planner = plannerOf(app, project, t.id);
    // Still writing it: wait for the turn to end.
    if (app.turns.isBusy(planner.ref) || app.queued.has(threadKey(planner.ref))) continue;
    if (planner.auto) {
      const key = `${project}::${t.id}::${at}`;
      if (app.autoStarted.has(key)) continue;
      app.autoStarted.add(key);
      void startTicket(app, project, t.id, planner.ref);
      continue;
    }
    const card = planCard(app, t, file, full, at);
    if (app.deps.store.threads.read(planner.ref).some((e) => e.text === card.text)) continue;
    record(app, planner.ref, [card]);
  }
}
