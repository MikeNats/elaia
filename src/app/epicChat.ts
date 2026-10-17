import { trustedEpic } from './epicTrust';
import type { AppState } from './types';

// What an epic's own chat is told each turn: the epic, its tickets and how far each is.
export function epicChatContext(app: AppState, project: string, slug: string): string {
  const epic = trustedEpic(app, project, slug);
  if (!epic)
    return `Elaia: this chat belongs to the epic in docs/elaia/epics/${slug}/, which cannot be read right now.`;
  const open = app.projects.get(project)?.tickets ?? [];
  const lines = epic.tickets.map((t) => {
    const live = open.find((o) => o.id === t.ticketId);
    const where = live ? `${live.position}, ${live.summary.text}` : t.state;
    return `- ${t.key} — ${t.title} — ${t.ticketId ?? 'not started'} — ${where}`;
  });
  return [
    `Elaia: you are the chat of the epic "${epic.title}" (docs/elaia/epics/${slug}/epic.json, status: ${epic.status}).`,
    `Goal: ${epic.goal}`,
    ...(lines.length > 0
      ? ['Its tickets — key — title — ticket id — where it is:', ...lines]
      : [`No tickets yet: your job is to work them out (brief: ${epic.brief || epic.goal}).`]),
    '',
    'Answer my questions about this epic and its tickets, and help me coordinate them.',
    'For live status run `glafka poreia --all`; to move a ticket on run `glafka vima <id>`.',
    'While the status is "proposed" you may edit epic.json (tickets, briefs, dependsOn) when I ask.',
    'Never edit status, approval, ticketId or state. Elaia makes the tickets, and each ticket is',
    'planned in its own chat, with its own questions. Never write a spec or plan, and never run',
    '`glafka create`, `glafka plan` or `glafka ergon`: a ticket gets its worktree and its coder',
    "from Elaia's Start button in its own chat.",
    'If I say "approve", tell me to press an Approve button on the epic card above.',
  ].join('\n');
}
