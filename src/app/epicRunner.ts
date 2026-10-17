import {
  allMerged,
  readyToStart,
  updateEpic,
  waitingOnCancelled,
  type Epic,
  type EpicTicket,
} from '@/epics';
import { epicThread } from '@/shared';
import { startTickets, withTicket } from './epicStart';
import { trustedEpic, trustedEpics } from './epicTrust';
import { note, workflowOf } from './record';
import type { AppState } from './types';

// A started ticket that left the open list was closed: merged, or cancelled.
async function settle(
  app: AppState,
  project: string,
  slug: string,
  epic: Epic,
  open: Set<string>,
): Promise<void> {
  for (const t of epic.tickets) {
    if (t.state !== 'started' || !t.ticketId || open.has(t.ticketId)) continue;
    const view = await workflowOf(app, project)
      .ticket(project, t.ticketId)
      .catch(() => null);
    if (view?.closed)
      updateEpic(project, slug, (e) =>
        withTicket(e, t.key, { state: view.cancelled ? 'cancelled' : 'merged' }),
      );
  }
}

// A blocked epic is checked on every refresh; say why once, not every minute.
function sayOnce(app: AppState, project: string, slug: string, text: string): void {
  const ref = { project, thread: epicThread(slug) };
  if (app.deps.store.threads.read(ref).some((e) => e.text === text)) return;
  note(app, ref, 'error', text);
}

// One line per cancelled ticket that others wait on: they never start on their own.
function cancelledLine(cancelled: EpicTicket, waiting: EpicTicket[]): string {
  const names = waiting.map((t) => `"${t.title}"`);
  const many = names.length > 1;
  const who = many
    ? `${names.slice(0, -1).join(', ')} and ${names.slice(-1).join('')}`
    : names.join('');
  const wait = many ? 'wait' : 'waits';
  const stays = many ? 'They do not start on their own' : 'It does not start on its own';
  return `${who} ${wait} on "${cancelled.title}", which was cancelled. ${stays}: change the plan here to go on.`;
}

// Moves every approved epic on: notes merged tickets, makes the ones now free to start.
// Runs only inside a refresh, so one project never has two runs at once.
export async function runEpics(app: AppState, project: string, open: Set<string>): Promise<void> {
  const blocked = workflowOf(app, project).cannotRunAlone(project);
  for (const read of trustedEpics(app, project)) {
    if (!read.epic || read.epic.status !== 'approved') continue;
    const { slug } = read;
    if (blocked) {
      sayOnce(app, project, slug, `Epic "${read.epic.title}" is waiting: ${blocked}`);
      continue;
    }
    await settle(app, project, slug, read.epic, open);
    await startTickets(
      app,
      project,
      slug,
      readyToStart(trustedEpic(app, project, slug) ?? read.epic),
    );
    const last = trustedEpic(app, project, slug);
    // A cancelled ticket never merges: the tickets waiting on it stay put, and you are told once.
    for (const { cancelled, waiting } of waitingOnCancelled(last ?? read.epic))
      sayOnce(app, project, slug, cancelledLine(cancelled, waiting));
    if (last && allMerged(last)) {
      updateEpic(project, slug, (e) => ({ ...e, status: 'done' }));
      note(
        app,
        { project, thread: epicThread(slug) },
        'progress',
        `Epic "${last.title}" is done: every ticket is merged.`,
      );
    }
  }
}
