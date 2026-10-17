import type { AgentChoice } from '@/chat';
import type { ThreadRef } from '@/shared';
import { agentFor } from './agent';
import { forEpicHandOff } from './epicHandOff';
import type { AppState } from './types';

// Blocked even in Auto: they reach outside the repo, or cannot be undone.
export const RISKY = [
  'Bash(git push:*)',
  'Bash(rm -rf:*)',
  'Bash(rm -fr:*)',
  'Bash(sudo:*)',
  'Bash(curl:*)',
  'Bash(wget:*)',
  'Bash(npm publish:*)',
];

// Auto: the agent runs commands without asking. Elaia's own block rules still hold (checked:
// deny rules apply in bypassPermissions), and the risky commands above stay blocked.
export function withPermissions(app: AppState, agent: AgentChoice): AgentChoice {
  if (agent.kind !== 'claude') return agent;
  // While a coder works the chat only reads. Auto would still let Bash write (`cat > file`), and
  // so would accepted edits: in default mode a command outside your allow list is refused.
  if (agent.readOnly) return { ...agent, permissionMode: 'default' };
  // Auto is the default (his choice); only an explicit "ask" keeps the cards.
  if (app.deps.settings().permissions === 'ask') return agent;
  const denyRules = [...(agent.denyRules ?? []), ...RISKY];
  return { ...agent, permissionMode: 'bypassPermissions', denyRules };
}

// The agent for one turn: who runs it, an epic hand-off's limits, your permission mode and the
// model you picked for the chat.
export function turnAgent(app: AppState, ref: ThreadRef, typed: string, push?: boolean) {
  const agent = withPermissions(app, forEpicHandOff(ref, typed, agentFor(app, ref, { push })));
  const model = app.deps.store.models.get(ref);
  return agent.kind === 'claude' && model ? { ...agent, model } : agent;
}
