import type { ThreadRef } from '@/shared';
import { folderFor } from './agent';
import { turnAgent } from './permissions';
import { noteAgent } from './liveAgents';
import { promptAndAgent } from './promptFor';
import { postSnapshot, showKept } from './record';
import type { AppState } from './types';

// What a turn asks of the agent, beyond what you typed.
export interface TurnOptions {
  // What the agent gets when it is not what you see (a button's command, say).
  prompt: string | null;
  // The Push button's turn: the only one that may push.
  push?: boolean;
  // A queued message: it is already in the thread, so it is not shown again.
  queued?: boolean;
}

// One agent turn. `shown` is what appears as your message; `text` is what you meant.
export async function turnOnce(
  app: AppState,
  ref: ThreadRef,
  shown: string,
  text: string,
  opts: TurnOptions,
) {
  const folder = folderFor(app, ref);
  // An epic you typed in the main chat: the turn may only write the epic file.
  const typed = opts.prompt === null ? text : '';
  const chosen = turnAgent(app, ref, typed, opts.push);
  const { prompt, agent } = promptAndAgent(app, ref, folder, chosen, opts.prompt ?? text);
  const turn = app.turns.run(
    {
      store: app.deps.store,
      now: app.deps.now,
      emit: (r, entries) => showKept(app, r, entries),
      agents: (r, e) => noteAgent(app, r, e),
    },
    { ref, folder, text: shown, prompt, agent },
  );
  postSnapshot(app);
  return { ...(await turn), folder };
}
