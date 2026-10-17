import type { Epic, EpicTicket } from './schema';

const merged = (t: EpicTicket | undefined) => t?.state === 'merged';

// Which tickets may start now. A ticket waits for everything it depends on to be merged;
// in an ordered epic it also waits for every ticket before it.
export function readyToStart(epic: Epic): EpicTicket[] {
  if (epic.status !== 'approved') return [];
  const byKey = new Map(epic.tickets.map((t) => [t.key, t]));
  return epic.tickets.filter((t, i) => {
    if (t.state !== 'waiting' || t.ticketId) return false;
    if (!t.dependsOn.every((key) => merged(byKey.get(key)))) return false;
    return !epic.ordered || epic.tickets.slice(0, i).every((before) => merged(before));
  });
}

export const allMerged = (epic: Epic) => epic.tickets.every((t) => t.state === 'merged');

export interface CancelledWait {
  cancelled: EpicTicket;
  waiting: EpicTicket[];
}

// Tickets that wait for a cancelled one: its dependsOn, or after it in an ordered epic.
// They never start on their own, so the epic chat says so.
export function waitingOnCancelled(epic: Epic): CancelledWait[] {
  return epic.tickets
    .map((cancelled, i) => ({
      cancelled,
      waiting: epic.tickets.filter(
        (t, j) =>
          t.state === 'waiting' &&
          !t.ticketId &&
          (t.dependsOn.includes(cancelled.key) || (epic.ordered && j > i)),
      ),
    }))
    .filter(({ cancelled, waiting }) => cancelled.state === 'cancelled' && waiting.length > 0);
}
