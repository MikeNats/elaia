import { headsOf, spellings } from '@/agents';
import type { AgentChoice } from '@/chat';
import type { ThreadRef } from '@/shared';
import { agentFor } from './agent';
import { forEpicHandOff } from './epicHandOff';
import type { AppState } from './types';

// Each head (git, /usr/bin/git, env git, xargs -n1 git) with each rest, as `X` and `X *`:
// a rule with two `*` misses the bare command, and a bare `git push` still pushes.
const risky = (program: string, rests: string[]) =>
  rests.flatMap((rest) => [
    ...spellings(headsOf(program), rest),
    ...(rest.endsWith('*') ? [] : spellings(headsOf(program), rest === '' ? '*' : `${rest} *`)),
  ]);

// Blocked even in Auto: they reach outside the repo, or cannot be undone. Claude matches rules
// as text, so these stop the usual spellings, not every one.
export const RISKY = [
  // `-* push` is git -C . push or git -c x=y push. Not `* push`: that blocks
  // `git commit -m "fix push"`.
  ...risky('git', ['push', '-* push']),
  // Every recursive delete: an agent has no terminal, so `rm -r` asks nothing, like `rm -rf`.
  ...risky('rm', ['-r*', '-R*', '-fr*', '-fR*', '* -r*', '* -R*', '*--recursive*']),
  ...risky('sudo', ['']),
  ...risky('curl', ['']),
  ...risky('wget', ['']),
  ...risky('npm', ['publish']),
];

// Auto: the agent runs commands without asking. Elaia's own block rules still hold (checked:
// deny rules apply in bypassPermissions), and the usual forms of the risky commands above are
// blocked. This is not a sandbox: a command written another way can still run.
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
