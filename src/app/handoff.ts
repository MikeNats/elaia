import { threadKey, type ThreadRef } from '@/shared';
import { askOldAgent, fromThread, save } from './handoffNote';
import { messageOf, note, postSnapshot } from './record';
import type { AppState } from './types';

const DEFAULT_PERCENT = 70;

// After a turn: over the line, the old agent writes its note and the next message goes to a
// fresh agent. A message sent meanwhile waits for the note.
export async function handOverIfFull(
  app: AppState,
  ref: ThreadRef,
  folder: string,
  context: { used: number; window: number } | null,
): Promise<void> {
  const line = app.deps.settings().handoffAt ?? DEFAULT_PERCENT;
  if (!context || line <= 0) return;
  const percent = Math.round((context.used / context.window) * 100);
  if (percent < line) return;
  // A failed handoff is said in the chat; a message waiting for it still goes out.
  const handing = handOver(app, ref, folder, percent).catch((err: unknown) =>
    note(app, ref, 'error', `The handoff note could not be saved: ${messageOf(err)}`),
  );
  app.handingOver.set(threadKey(ref), handing);
  await handing.finally(() => app.handingOver.delete(threadKey(ref)));
}

// The old agent writes a note, Elaia keeps it, and your next message starts a fresh agent.
async function handOver(app: AppState, ref: ThreadRef, folder: string, percent: number) {
  const session = app.deps.store.sessions.get(ref, folder);
  if (!session) return;
  note(
    app,
    ref,
    'progress',
    `This chat's agent is ${percent}% full. It is writing a handoff note.`,
  );
  // Forget it first, so nothing can resume the full session again.
  app.deps.store.sessions.forget(ref, folder);
  const asking = askOldAgent(app, ref, folder, session).catch(() => '');
  postSnapshot(app);
  const written = await asking;
  const by = written ? 'the old agent' : 'Elaia';
  const about = `Written by ${by} on ${app.deps.now().slice(0, 16)}, when it was ${percent}% full.`;
  const file = save(app, ref, written || fromThread(app, ref), about);
  note(
    app,
    ref,
    'progress',
    `A fresh agent takes over on your next message. Handoff note: ${file}`,
  );
}
