import type { ThreadRef } from '@/shared';
import { workflowOf } from './record';
import type { AppState } from './types';

// A `command` chat with no elaia.agentCommand runs the repo's own .glafka.json command.
// A cloned repo could put anything there, so it runs only after you said yes to it once.
export async function repoCommandAllowed(app: AppState, ref: ThreadRef): Promise<boolean> {
  const s = app.deps.settings();
  if (s.agent !== 'command' || s.agentCommand.trim()) return true;
  const command = workflowOf(app, ref.project).agentCommand(ref.project, '');
  if (!command || app.deps.store.trusted.has(ref.project, command)) return true;
  const text =
    `This repo's settings ask Elaia to run this command for its chats:\n\n${command}\n\n` +
    'Run it? Only say yes if you trust this repo.';
  const yes = (await app.deps.confirm?.(text, 'Run it')) ?? false;
  if (yes) app.deps.store.trusted.add(ref.project, command);
  return yes;
}
