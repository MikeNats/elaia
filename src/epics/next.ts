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
