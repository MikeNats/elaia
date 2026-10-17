import { PROJECT_THREAD, type ThreadRef } from '@/shared';
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

// Your last words in the main chat: the ask the ticket was made from.
function lastAsk(app: AppState, ref: ThreadRef): string | null {
  const said = app.deps.store.threads.read(ref).filter((e) => e.kind === 'you');
  return said.at(-1)?.text ?? null;
}

// After a main-chat turn: a ticket it just made (no spec, not in an epic, nothing said in its
// own chat yet) moves to its own chat, which opens. An epic's tickets start from the epic.
export function handOffNewTickets(app: AppState, project: string): void {
  const main = { project, thread: PROJECT_THREAD };
  for (const t of app.projects.get(project)?.tickets ?? []) {
    if (t.closed || t.planned || t.specPath || inEpic(app, project, t.id)) continue;
    const ref = { project, thread: t.id };
    if (app.deps.store.threads.read(ref).some((e) => e.kind === 'you')) continue;
    const title = t.title ?? t.id;
    startGenesis(app, project, { id: t.id, title, brief: lastAsk(app, main) ?? title, epic: null });
    const open = { kind: 'open' as const, label: 'Open ticket chat', value: t.id };
    const text = `"${title}" goes on in its own chat: its questions, spec and plan come there.`;
    record(app, main, [{ ...chatEntry(app, 'progress', text), actions: [open] }]);
    app.deps.post({ type: 'focus', ref });
  }
}
