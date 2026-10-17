import { EDIT_TOOLS } from '@/agents';
import type { AppState } from './types';

// The main chat may read every worktree but edit none: a coder may be working in it.
export const worktreeReadOnly = (worktreesDir: string) =>
  EDIT_TOOLS.map((tool) => `${tool}(${worktreesDir}/**)`);

// What the main chat is told each turn, so it knows which worktree is which ticket.
export function ticketList(app: AppState, project: string): string {
  const tickets = app.projects.get(project)?.tickets ?? [];
  if (tickets.length === 0) return 'Elaia: this repo has no open tickets right now.';
  return [
    'Elaia: the open tickets in this repo. You may read their worktrees but not edit them,',
    'because a coder may be working there. Ticket — title — stage — worktree:',
    ...tickets.map(
      (t) =>
        `- ${t.id} — ${t.title ?? 'untitled'} — ${t.position} — ${t.worktree ?? 'no worktree yet'}`,
    ),
  ].join('\n');
}
