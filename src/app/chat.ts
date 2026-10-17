import { threadKey, type ThreadRef } from '@/shared';
import { queueIfBusy, takeQueued } from './queue';
import { clearAgents } from './liveAgents';
import { trustedNow } from './repoTrust';
import { handOverIfFull } from './handoff';
import { chatEntry, messageOf, note, postSnapshot, record } from './record';
import { afterTurn } from './setup';
import { notNow } from './typedStep';
import { turnOnce, type TurnOptions } from './turnOnce';
import { holdForTrust, NOT_TRUSTED_TURN, offerTrust } from './trustCard';
import type { AppState } from './types';

const ANOTHER_WINDOW = 'This chat is answering in another VS Code window. Wait for it there.';

async function runTurn(
  app: AppState,
  ref: ThreadRef,
  text: string,
  opts: TurnOptions,
): Promise<void> {
  // VS Code is closing: no agent may start now.
  if (app.disposed) return;
  const key = threadKey(ref);
  // One agent per chat in every VS Code window, not only in this one.
  if (!app.deps.store.locks.take(key)) {
    note(app, ref, 'error', ANOTHER_WINDOW);
    // The messages after this one still get their turn.
    return runNext(app, ref);
  }
  // Tickets made from now on are this turn's: only those go to their own chat.
  const since = app.deps.now();
  let ran = false;
  try {
    // A button pressed while the old agent writes its handoff note goes to the fresh agent.
    await app.handingOver.get(key);
    if (!trustedNow(app, ref.project)) {
      // No return: the queue below still moves on. This turn waits for your Trust.
      holdForTrust(app, ref, text, opts);
      note(app, ref, 'error', NOT_TRUSTED_TURN);
      offerTrust(app, ref.project, true);
    } else {
      ran = true;
      await agentTurn(app, ref, text, opts);
    }
  } catch (err) {
    record(app, ref, [chatEntry(app, 'error', messageOf(err))]);
  } finally {
    clearAgents(app, ref);
    app.deps.store.locks.release(key);
  }
  postSnapshot(app);
  // Stopped because VS Code is closing: afterTurn could start glafka's next agent.
  if (app.disposed) return;
  try {
    // The agent may have run glafka commands; pick up what changed.
    await afterTurn(app, ref, { since, text, ran });
  } catch (err) {
    // A run file deleted under us, say. The chat says so, and the queue still moves.
    record(app, ref, [chatEntry(app, 'error', messageOf(err))]);
  }
  await runNext(app, ref);
}

// The agent's part of a turn: a fresh session if the saved one is gone, then a handoff if full.
async function agentTurn(app: AppState, ref: ThreadRef, text: string, opts: TurnOptions) {
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
}

// The next waiting turn, if any. Its line is already in the thread.
async function runNext(app: AppState, ref: ThreadRef): Promise<void> {
  const next = takeQueued(app, ref);
  if (next)
    await runTurn(app, ref, next.text, { prompt: next.prompt, push: next.push, queued: true });
}

// After Trust: the turns that waited for it, one after another. Their lines are shown already.
export async function runHeld(app: AppState, project: string): Promise<void> {
  const held = app.heldForTrust.get(project) ?? [];
  app.heldForTrust.delete(project);
  for (const turn of held) {
    if (app.disposed) return;
    if (queueIfBusy(app, turn.ref, turn, false)) continue;
    await runTurn(app, turn.ref, turn.text, { prompt: turn.prompt, push: turn.push, queued: true });
  }
}

// A turn Elaia starts for you: `shown` is your line in the thread, `prompt` what the agent gets.
export function chatTurn(
  app: AppState,
  ref: ThreadRef,
  shown: string,
  prompt: string,
  opts: { push?: boolean } = {},
) {
  if (app.disposed) return Promise.resolve();
  if (queueIfBusy(app, ref, { text: shown, prompt, ...opts })) return Promise.resolve();
  return runTurn(app, ref, shown, { prompt, ...opts });
}

export async function send(app: AppState, ref: ThreadRef, text: string): Promise<void> {
  // VS Code is closing: the message is not taken (it would only wait for ever).
  if (app.disposed) return;
  if (!(await notNow(app, ref, text))) await runTurn(app, ref, text, { prompt: null });
}
