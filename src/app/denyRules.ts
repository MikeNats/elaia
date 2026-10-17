import path from 'node:path';
import { EDIT_TOOLS } from '@/agents';
import { epicSlugOf, PROJECT_THREAD, type ThreadRef } from '@/shared';
import { workflowOf } from './record';
import { worktreeReadOnly } from './ticketList';
import type { AppState } from './types';

// Edit rules for files, both here and in the main checkout: a worktree chat reaches the
// main checkout's docs through --add-dir. `//` starts an absolute path in a Claude rule.
const lockRules = (project: string, files: string[]) =>
  files.flatMap((file) =>
    EDIT_TOOLS.flatMap((tool) => [`${tool}(${file})`, `${tool}(/${path.join(project, file)})`]),
  );

// A worktree goes only with its ticket's close; removed by hand, the ticket stays open for ever.
const WORKTREE_REMOVE = ['Bash(git worktree remove:*)', 'Bash(git -C * worktree remove *)'];

// A ticket chat keeps to its own ticket: no step of another ticket, and no edit in its worktree.
function otherTickets(app: AppState, ref: ThreadRef): string[] {
  const workflow = workflowOf(app, ref.project);
  const others = (app.projects.get(ref.project)?.tickets ?? []).filter((t) => t.id !== ref.thread);
  const worktrees = others.flatMap((t) => (t.worktree ? [t.worktree] : []));
  return [
    ...workflow.otherTicketsDenied(others.map((t) => t.id)),
    ...worktrees.flatMap((w) => EDIT_TOOLS.map((tool) => `${tool}(/${w}/**)`)),
  ];
}

// A ticket still being planned in its own chat: the Start button makes its worktree and coder.
function stillPlanning(app: AppState, ref: ThreadRef): string[] {
  const ticket = app.projects.get(ref.project)?.tickets.find((t) => t.id === ref.thread);
  return ticket && !ticket.planned ? workflowOf(app, ref.project).plannerDenied : [];
}

// What a chat may never do, as Claude deny rules. `push` is set only for the Push button's turn.
export function denyRulesFor(app: AppState, ref: ThreadRef, turn: { push?: boolean }): string[] {
  const workflow = workflowOf(app, ref.project);
  // Every chat: the tool's own files stay as they are, only the Push button pushes,
  // and no worktree is removed by hand.
  const rules = [
    ...lockRules(ref.project, workflow.lockedFiles),
    ...(turn.push ? [] : workflow.pushOnly),
    ...WORKTREE_REMOVE,
  ];
  // Ticket and epic chats: nor the files that say which commands the tool runs. Nor do they
  // make tickets: Elaia makes an epic's tickets, and a ticket chat keeps to its own.
  if (ref.thread !== PROJECT_THREAD)
    rules.push(...lockRules(ref.project, workflow.lockedOutsideMain), ...workflow.createDenied);
  // Main chat and epic chats plan: worktrees read-only, and no worktree or coder started here.
  if (ref.thread === PROJECT_THREAD || epicSlugOf(ref.thread))
    rules.push(...worktreeReadOnly(workflow.worktreesDir), ...workflow.plannerDenied);
  else rules.push(...otherTickets(app, ref), ...stillPlanning(app, ref));
  return rules;
}
