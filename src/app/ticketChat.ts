import type { ThreadRef } from '@/shared';
import { chatTurn } from './chat';
import { chatEntry, note, record, workflowOf } from './record';
import { refresh } from './refresh';
import { startTicket } from './ticketStart';
import type { AppState } from './types';

// "Push it" on a ready ticket: the chat runs the tool's own push step.
// `said` is your line: the button's label, or the word you typed.
export function push(app: AppState, ref: ThreadRef, said = 'Push it'): Promise<void> {
  const prompt = workflowOf(app, ref.project).pushPrompt(ref.thread);
  return chatTurn(app, ref, said, prompt, { push: true });
}

// "Merge it" after a push with no pull request: the chat merges the branch into the base branch
// in the main checkout and runs the checks there. Closing stays with the Close button.
export function merge(app: AppState, ref: ThreadRef): Promise<void> {
  const ticket = app.projects.get(ref.project)?.tickets.find((t) => t.id === ref.thread);
  const base = workflowOf(app, ref.project).baseRef(ref.project);
  const branch = ticket?.branch ?? `the branch of ticket ${ref.thread}`;
  const prompt = [
    `Merge ${branch} into ${base} in the main checkout at ${ref.project}:`,
    `git -C ${ref.project} merge --ff-only ${branch}, or a normal merge if fast-forward is not possible.`,
    'Then run the check command in the main checkout. Do not delete the worktree or the branch:',
    'the Close ticket button does that. End with one line: merged or not, and the check result.',
  ].join('\n');
  return chatTurn(app, ref, 'Merge it', prompt);
}

// "Close ticket" (glafka: lysis) or "Cancel ticket" (glafka: cancel). If the tool refuses, its reason shows here.
async function endTicket(
  app: AppState,
  ref: ThreadRef,
  said: string,
  how: 'close' | 'cancel',
): Promise<void> {
  record(app, ref, [chatEntry(app, 'you', said)]);
  const result = await workflowOf(app, ref.project)[how](ref.project, ref.thread);
  if (result.code !== 0) {
    const why = (result.stderr || result.stdout).trim().split('\n').slice(0, 8).join('\n');
    note(
      app,
      ref,
      'error',
      `The ticket was not ${how === 'close' ? 'closed' : 'cancelled'}:\n${why}`,
    );
  }
  await refresh(app, ref.project);
}

export const closeTicket = (app: AppState, ref: ThreadRef, said = 'Close ticket') =>
  endTicket(app, ref, said, 'close');

export const cancelTicket = (app: AppState, ref: ThreadRef) =>
  endTicket(app, ref, 'Cancel ticket', 'cancel');

// The buttons that act on a ticket: start (pressed in the chat `from`), push, merge, close, cancel.
export const ticketActions = (app: AppState) => ({
  startTicket: (from: ThreadRef, id: string) => startTicket(app, from.project, id, from, true),
  push: (ref: ThreadRef) => push(app, ref),
  merge: (ref: ThreadRef) => merge(app, ref),
  closeTicket: (ref: ThreadRef) => closeTicket(app, ref),
  cancelTicket: (ref: ThreadRef) => cancelTicket(app, ref),
});
