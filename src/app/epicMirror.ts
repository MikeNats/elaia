import { readEpics } from '@/epics';
import { epicSlugOf, epicThread, PROJECT_THREAD, type ThreadEntry, type ThreadRef } from '@/shared';

// Entries that wait for you. In an epic, they also show in the epic's chat.
const WAITS_FOR_YOU = new Set<ThreadEntry['kind']>(['question', 'approval', 'needs-you']);

const markdown = (e: ThreadEntry) => e.source === 'chat' || e.kind === 'approval';

function epicOf(project: string, ticketId: string) {
  for (const { slug, epic } of readEpics(project)) {
    const ticket = epic?.tickets.find((t) => t.ticketId === ticketId);
    if (ticket) return { slug, title: ticket.title };
  }
  return null;
}

// A ticket's questions and approvals, copied into its epic chat. Buttons still answer the ticket.
export function copiesForEpic(
  ref: ThreadRef,
  entries: ThreadEntry[],
): { epicRef: ThreadRef; copies: ThreadEntry[] } | null {
  if (ref.thread === PROJECT_THREAD || epicSlugOf(ref.thread)) return null;
  const waiting = entries.filter((e) => e.shown && WAITS_FOR_YOU.has(e.kind));
  if (waiting.length === 0) return null;
  const found = epicOf(ref.project, ref.thread);
  if (!found) return null;
  const open = { kind: 'open' as const, label: 'Open ticket chat', value: ref.thread };
  const copies = waiting.map((e) => ({
    ...e,
    // Markdown cards get the ticket's name as a bold line; plain lines get it in front.
    text: markdown(e) ? `**${found.title}**\n\n${e.text}` : `${found.title}: ${e.text}`,
    actions: [...(e.actions ?? []).map((a) => ({ ...a, thread: ref.thread })), open],
  }));
  return { epicRef: { project: ref.project, thread: epicThread(found.slug) }, copies };
}
