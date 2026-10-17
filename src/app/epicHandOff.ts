import type { AgentChoice } from '@/chat';
import { PROJECT_THREAD, type ThreadRef } from '@/shared';

const EPIC = /\bepics?\b/i;

// You asked the main chat for an epic. Its whole job is to write the epic file; the epic's own
// chat does the research. Words alone did not stop it exploring first, so the turn gets no
// tools to explore with: only Write, and Bash within your allow rules (plus mv for the inbox).
export function forEpicHandOff(ref: ThreadRef, typed: string, agent: AgentChoice): AgentChoice {
  if (ref.thread !== PROJECT_THREAD || !EPIC.test(typed) || agent.kind !== 'claude') return agent;
  return {
    ...agent,
    tools: ['Write', 'Bash'],
    allowedTools: [...agent.allowedTools, 'Bash(mv:*)'],
  };
}
