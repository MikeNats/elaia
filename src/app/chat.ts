import { threadKey, type ThreadRef } from '@/shared';
import { folderFor } from './agent';
import { turnAgent } from './permissions';
import { queueIfBusy, takeQueued } from './queue';
import { clearAgents, noteAgent } from './liveAgents';
import { repoCommandAllowed } from './repoCommand';
import { promptAndAgent } from './promptFor';
import { handOverIfFull } from './handoff';
import { chatEntry, messageOf, note, postSnapshot, record, showKept } from './record';
import { afterTurn } from './setup';
import { notNow } from './typedStep';
import type { AppState } from './types';

// What a turn asks of the agent, beyond what you typed.
interface TurnOptions {
  // What the agent gets when it is not what you see (a button's command, say).
  prompt: string | null;
  // The Push button's turn: the only one that may push.
  push?: boolean;
  // A queued message: it is already in the thread, so it is not shown again.
  queued?: boolean;
}

// One agent turn. `shown` is what appears as your message; `text` is what you meant.
async function turnOnce(
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

async function runTurn(
  app: AppState,
  ref: ThreadRef,
  text: string,
  opts: TurnOptions,
): Promise<void> {
  const key = threadKey(ref);
  // One agent per chat in every VS Code window, not only in this one.
  if (!app.deps.store.locks.take(key))
    return note(
      app,
      ref,
      'error',
      'This chat is answering in another VS Code window. Wait for it there.',
    );
  // Tickets made from now on are this turn's: only those go to their own chat.
  const since = app.deps.now();
  try {
    // A button pressed while the old agent writes its handoff note goes to the fresh agent.
    await app.handingOver.get(key);
    if (!(await repoCommandAllowed(app, ref)))
      return note(
        app,
        ref,
        'error',
        "Elaia did not run the repo's agent command. Set elaia.agentCommand.",
      );
    let result = await turnOnce(app, ref, opts.queued ? '' : text, text, opts);
    if (result.resumeFailed) {
      // Claude cleans old sessions away. Start fresh, with the thread handed over.
      record(app, ref, [
        chatEntry(
          app,
          'progress',
          'The saved session was gone. Starting a fresh one with the thread handed over.',
        ),
      ]);
      // The same request again: a button's own command, not its label.
      result = await turnOnce(app, ref, '', text, opts);
    }
    await handOverIfFull(app, ref, result.folder, result.context);
  } catch (err) {
    record(app, ref, [chatEntry(app, 'error', messageOf(err))]);
  } finally {
    clearAgents(app, ref);
    app.deps.store.locks.release(key);
  }
  postSnapshot(app);
  // The agent may have run glafka commands; pick up what changed.
  await afterTurn(app, ref, { since, text });
  const next = takeQueued(app, ref);
  if (next) await runTurn(app, ref, next.text, { ...next, queued: true });
}

// A turn Elaia starts for you: `shown` is your line in the thread, `prompt` what the agent gets.
export function chatTurn(
  app: AppState,
  ref: ThreadRef,
  shown: string,
  prompt: string,
  opts: { push?: boolean } = {},
) {
  if (queueIfBusy(app, ref, { text: shown, prompt, ...opts })) return Promise.resolve();
  return runTurn(app, ref, shown, { prompt, ...opts });
}

export async function send(app: AppState, ref: ThreadRef, text: string): Promise<void> {
  if (!(await notNow(app, ref, text))) await runTurn(app, ref, text, { prompt: null });
}
