import { PROJECT_THREAD, type TicketView } from '@/shared';
import type { TicketBrief } from '@/workflow';
import { chatTurn } from './chat';
import { trustedEpics } from './epicTrust';
import { chatEntry, record, workflowOf } from './record';
import type { AppState } from './types';

// A ticket's own chat plans it with you: Elaia starts that turn, the questions come there.
export function startGenesis(app: AppState, project: string, ticket: TicketBrief): void {
  const ref = { project, thread: ticket.id };
  void chatTurn(
    app,
    ref,
    'Plan this ticket with me',
    workflowOf(app, project).ticketGenesisPrompt(ticket),
  );
}

const inEpic = (app: AppState, project: string, id: string) =>
  trustedEpics(app, project).some(({ epic }) => epic?.tickets.some((t) => t.ticketId === id));

// When a main-chat turn started, and the line it answered.
export interface TurnStart {
  since: string;
  text: string;
}

// Made during this turn. An older ticket (from a terminal, or from before the project was
// added) stays where it is. A ticket with no created time counts as old.
const madeSince = (t: TicketView, since: string) =>
  t.created != null && Date.parse(t.created) >= Date.parse(since);

// After a main-chat turn: a ticket made during it (no spec, not in an epic, nothing said in its
// own chat yet) moves to its own chat, which opens. An epic's tickets start from the epic.
export function handOffNewTickets(app: AppState, project: string, turn: TurnStart): void {
  const main = { project, thread: PROJECT_THREAD };
  for (const t of app.projects.get(project)?.tickets ?? []) {
    if (!madeSince(t, turn.since)) continue;
    if (t.closed || t.planned || t.specPath || inEpic(app, project, t.id)) continue;
    const ref = { project, thread: t.id };
    if (app.deps.store.threads.read(ref).some((e) => e.kind === 'you')) continue;
    const title = t.title ?? t.id;
    startGenesis(app, project, { id: t.id, title, brief: turn.text || title, epic: null });
    const open = { kind: 'open' as const, label: 'Open ticket chat', value: t.id };
    const text = `"${title}" goes on in its own chat: its questions, spec and plan come there.`;
    record(app, main, [{ ...chatEntry(app, 'progress', text), actions: [open] }]);
    app.deps.post({ type: 'focus', ref });
  }
}
