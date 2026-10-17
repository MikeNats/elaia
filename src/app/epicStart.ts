import { readyToStart, updateEpic, type Epic, type EpicTicket } from '@/epics';
import { epicThread } from '@/shared';
import type { TicketBrief } from '@/workflow';
import { trustedEpic } from './epicTrust';
import { messageOf, note, workflowOf } from './record';
import { startGenesis } from './ticketHandOff';
import type { AppState } from './types';

export const withTicket = (epic: Epic, key: string, change: Partial<EpicTicket>): Epic => ({
  ...epic,
  tickets: epic.tickets.map((t) => (t.key === key ? { ...t, ...change } : t)),
});

// Still free to start, read from the file right now: a ticket started a moment ago must not start twice.
const stillReady = (app: AppState, project: string, slug: string, key: string) => {
  const epic = trustedEpic(app, project, slug);
  return epic && readyToStart(epic).some((t) => t.key === key) ? epic : null;
};

// Makes the tickets in the tool and records them in the epic. Then each ticket's own chat plans
// it with you, all at the same time; when a plan is written, a Start card shows there.
export async function startTickets(
  app: AppState,
  project: string,
  slug: string,
  ready: EpicTicket[],
): Promise<void> {
  const workflow = workflowOf(app, project);
  const ref = { project, thread: epicThread(slug) };
  const made: TicketBrief[] = [];
  for (const t of ready) {
    const key = `${project}::${slug}::${t.key}`;
    if (app.starting.has(key)) continue;
    const epic = stillReady(app, project, slug, t.key);
    if (!epic) continue;
    app.starting.add(key);
    try {
      const id = await workflow.create(project, t.title);
      updateEpic(project, slug, (e) => withTicket(e, t.key, { ticketId: id, state: 'started' }));
      made.push({
        id,
        title: t.title,
        brief: t.brief,
        epic: {
          title: epic.title,
          file: `docs/elaia/epics/${slug}/epic.json`,
          sources: epic.sources,
        },
      });
    } catch (err) {
      note(app, ref, 'error', `Could not create "${t.title}": ${messageOf(err)}`);
    } finally {
      app.starting.delete(key);
    }
  }
  if (made.length === 0) return;
  const names = made.map((t) => t.title).join(', ');
  const where = made.length === 1 ? 'its own chat' : 'their own chats, all at once';
  note(app, ref, 'progress', `Created ${names}. They are planned in ${where}.`);
  for (const ticket of made) startGenesis(app, project, ticket);
}
