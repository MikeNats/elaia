import { threadKey, type ThreadRef } from '@/shared';
import { folderFor } from './agent';
import { allow } from './allow';
import { send } from './chat';
import { keepSoon } from './keep';
import { knowWritten } from './known';
import { note } from './record';
import { threadPage } from './ticketIntro';
import type { AppState } from './types';

const CLEARED = 'Cleared. Your next message starts a fresh agent. Old messages are still saved.';

// Your Clear: the agent is forgotten. The next one gets no old messages and no handoff note.
export function clearChat(app: AppState, ref: ThreadRef): void {
  if (app.turns.isBusy(ref) || app.handingOver.has(threadKey(ref))) {
    note(app, ref, 'error', 'Not cleared: the agent is still working. Wait, or press Stop.');
    return;
  }
  app.deps.store.sessions.forget(ref, folderFor(app, ref));
  // Saved, never shown: it only marks where the screen starts again.
  app.deps.store.threads.append(ref, [
    { at: app.deps.now(), kind: 'cleared', text: CLEARED, shown: true, source: 'chat' },
  ]);
  knowWritten(app, ref, 1);
  keepSoon(app, ref);
  app.deps.post({ type: 'thread', ref, entries: threadPage(app, ref) });
}

// What you do in a chat: send, allow a refused tool, stop, clear.
export const chatActions = (app: AppState) => ({
  send: (ref: ThreadRef, text: string) => send(app, ref, text),
  allow: (ref: ThreadRef, rule: string) => allow(app, ref, rule),
  stop: (ref: ThreadRef): void => {
    app.turns.stop(ref);
  },
  clearChat: (ref: ThreadRef) => clearChat(app, ref),
});
