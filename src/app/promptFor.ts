import { contextPrompt, type AgentChoice } from '@/chat';
import type { ThreadRef } from '@/shared';
import { ticketOf } from './agent';
import { latestHandoff, sinceClear } from './handoffNote';
import type { AppState } from './types';

const TAIL = 20;

// A resumed session already knows the thread. A new one (new folder, or no sessions) gets it handed over.
export function promptFor(
  app: AppState,
  ref: ThreadRef,
  folder: string,
  agent: AgentChoice,
  text: string,
): string {
  const { tail: shown, clearedAt } = sinceClear(app, ref, TAIL);
  // On a retry your message is already in the thread; do not send it twice.
  const yours = shown.findLastIndex((e) => e.kind === 'you');
  const tail = shown[yours]?.text === text ? shown.filter((_, i) => i !== yours) : shown;
  const resumed = agent.kind === 'claude' && app.deps.store.sessions.get(ref, folder) !== null;
  if (resumed || (agent.kind === 'claude' && tail.length === 0)) return text;
  const ticket = ticketOf(app, ref);
  return contextPrompt({
    ticketId: ticket?.id ?? null,
    title: ticket?.title ?? null,
    specPath: ticket?.specPath ?? null,
    planPath: ticket?.planPath ?? null,
    folder,
    thread: ref.thread,
    handoff: latestHandoff(ref, clearedAt),
    tail,
    text,
  });
}

// What the agent gets, and the agent itself. A skill command (`/glafka:epistle 12`) works only
// as the first word of the prompt, so a fresh agent gets the thread in its system prompt instead.
export function promptAndAgent(
  app: AppState,
  ref: ThreadRef,
  folder: string,
  agent: AgentChoice,
  text: string,
): { prompt: string; agent: AgentChoice } {
  if (agent.kind !== 'claude' || !text.startsWith('/'))
    return { prompt: promptFor(app, ref, folder, agent, text), agent };
  const context = promptFor(app, ref, folder, agent, '');
  if (!context) return { prompt: text, agent };
  const extraSystemPrompt = [agent.extraSystemPrompt, context].filter(Boolean).join('\n\n');
  return { prompt: text, agent: { ...agent, extraSystemPrompt } };
}
