import type { Epic } from '@/epics';
import { epicThread, PROJECT_THREAD } from '@/shared';
import { chatTurn } from './chat';
import { record } from './record';
import type { AppState } from './types';

// The epic chat's first job: work out the tickets. The main chat only wrote the goal and brief.
function planningPrompt(slug: string, epic: Epic): string {
  const sources =
    epic.sources.length > 0 ? `Sources: ${epic.sources.join(', ')}` : 'No source files.';
  return [
    `Work out the tickets for this epic, "${epic.title}".`,
    `Goal: ${epic.goal}`,
    `Brief: ${epic.brief || epic.goal}`,
    sources,
    '',
    'Do the research it needs first. For reviews, run several at once with subagents (one per area,',
    'for example security, performance, bugs, tests), read their findings, and keep only real ones.',
    `Then write the tickets into docs/elaia/epics/${slug}/epic.json, as "tickets": [{"key", "title",`,
    '"brief": what to build and how we know it works, "dependsOn": [other keys]}]. Each ticket must be',
    'buildable and reviewable on its own. Change only "tickets" (and "goal" if it was unclear).',
    'Never touch status, approval, ticketId or state. Then stop with a short summary of the cut:',
    'Elaia shows me the cut to approve.',
  ].join('\n');
}

// A new epic with no tickets: say so in the main chat, open the epic chat, and start it.
export function startPlanning(app: AppState, project: string, slug: string, epic: Epic): void {
  const key = `${project}::plan::${slug}`;
  if (app.starting.has(key)) return;
  app.starting.add(key);
  const ref = { project, thread: epicThread(slug) };
  const text = `Created the epic "${epic.title}". Its own chat is working out the tickets.`;
  const open = { kind: 'open' as const, label: 'Open epic chat', value: ref.thread };
  record(app, { project, thread: PROJECT_THREAD }, [
    { at: app.deps.now(), kind: 'progress', text, shown: true, source: 'chat', actions: [open] },
  ]);
  app.deps.post({ type: 'focus', ref });
  void chatTurn(app, ref, 'Work out the tickets', planningPrompt(slug, epic)).finally(() =>
    app.starting.delete(key),
  );
}
