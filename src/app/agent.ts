import { existsSync } from 'node:fs';
import { WINDOW_ONLY_TOOLS } from '@/agents';
import type { AgentChoice } from '@/chat';
import { MEMORY_TOOLS } from '@/memory';
import { epicSlugOf, PROJECT_THREAD, type ThreadRef, type TicketView } from '@/shared';
import { workflowOf } from './record';
import { CHAT_RULES, EPIC_RULES, TICKET_RULES } from './chatRules';
import { epicChatContext } from './epicChat';
import { denyRulesFor } from './denyRules';
import { ticketList } from './ticketList';
import type { AppState } from './types';

const ACTIVE = new Set(['running', 'stalled']);

export function ticketOf(app: AppState, ref: ThreadRef): TicketView | null {
  if (ref.thread === PROJECT_THREAD) return null;
  return app.projects.get(ref.project)?.tickets.find((t) => t.id === ref.thread) ?? null;
}

// The ticket's worktree once it exists, else the main checkout.
export function folderFor(app: AppState, ref: ThreadRef): string {
  const worktree = ticketOf(app, ref)?.worktree;
  return worktree && existsSync(worktree) ? worktree : ref.project;
}

// While a background coder owns the files, the chat may read but not edit.
export function coderWorking(app: AppState, ref: ThreadRef): boolean {
  return ACTIVE.has(ticketOf(app, ref)?.coder.state ?? '');
}

// A ticket's chat: its worktree, and rules that keep it to this one ticket. In its worktree it
// still needs the spec and plan, which live in the main checkout.
function ticketChat(app: AppState, ref: ThreadRef) {
  const workflow = workflowOf(app, ref.project);
  const inWorktree = folderFor(app, ref) !== ref.project;
  const ticket = ticketOf(app, ref);
  const place = {
    id: ref.thread,
    title: ticket?.title ?? ref.thread,
    worktree: inWorktree ? (ticket?.worktree ?? null) : null,
    branch: ticket?.branch ?? null,
  };
  return {
    addDirs: inWorktree ? [workflow.docsDir(ref.project)] : [],
    extraSystemPrompt: [CHAT_RULES, workflow.ticketRules(place), TICKET_RULES].join('\n\n'),
  };
}

// `push` is set only for the turn the Push button starts: no other turn may push.
export function agentFor(
  app: AppState,
  ref: ThreadRef,
  turn: { push?: boolean } = {},
): AgentChoice {
  const s = app.deps.settings();
  const readOnly = coderWorking(app, ref);
  if (s.agent === 'command') {
    if (readOnly) {
      throw new Error(
        'A coder is working in this ticket. A `command` agent cannot be kept from editing files, ' +
          'so this chat waits until the coder finishes.',
      );
    }
    const command = workflowOf(app, ref.project).agentCommand(ref.project, s.agentCommand);
    if (!command) {
      throw new Error(
        'No agent command. Set elaia.agentCommand, or agents.default in .glafka.json.',
      );
    }
    return { kind: 'command', command };
  }
  // Tools you allowed in this thread could still edit (a Bash rule, say), so they wait too.
  // An old "Allow AskUserQuestion" from before it was blocked must not come back in.
  const fromThread = app.deps.store.sessions
    .allowed(ref)
    .filter((rule) => !(WINDOW_ONLY_TOOLS as readonly string[]).includes(rule));
  const toolRules = [...workflowOf(app, ref.project).allowedTools, ...MEMORY_TOOLS];
  const allowed = readOnly
    ? [...s.allowedTools, ...toolRules]
    : [...s.allowedTools, ...toolRules, ...fromThread];
  const claude = {
    kind: 'claude' as const,
    bin: s.claudePath,
    permissionMode: s.permissionMode,
    allowedTools: allowed,
    readOnly,
    denyRules: denyRulesFor(app, ref, turn),
  };
  const workflow = workflowOf(app, ref.project);
  const slug = epicSlugOf(ref.thread);
  // An epic's chat: the repo, worktrees read-only, and the epic with each ticket's place.
  if (slug) {
    const context = epicChatContext(app, ref.project, slug);
    return {
      ...claude,
      extraSystemPrompt: `${CHAT_RULES}\n\n${context}`,
    };
  }
  if (ref.thread !== PROJECT_THREAD) return { ...claude, ...ticketChat(app, ref) };
  // The main chat: the whole repo, worktrees read-only, and today's ticket list. It plans one
  // ticket itself, or writes an epic for more.
  return {
    ...claude,
    extraSystemPrompt: [
      CHAT_RULES,
      workflow.newTicketRules,
      EPIC_RULES,
      ticketList(app, ref.project),
    ].join('\n\n'),
  };
}
