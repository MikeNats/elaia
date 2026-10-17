import type { CommandResult } from '@/workflow';
import { PROJECT_THREAD, type ThreadRef } from '@/shared';
import { trustedEpics } from './epicTrust';
import { chatEntry, messageOf, note, postSnapshot, record, workflowOf } from './record';
import { refresh } from './refresh';
import type { AppState } from './types';

// Every ticket is planned in its own chat. `auto`: its epic was approved as a whole, so its plan
// starts without a Start button.
export function plannerOf(
  app: AppState,
  project: string,
  id: string,
): { ref: ThreadRef; auto: boolean } {
  const ref = { project, thread: id };
  for (const { epic } of trustedEpics(app, project)) {
    if (epic?.tickets.some((t) => t.ticketId === id))
      return { ref, auto: epic.status === 'approved' && epic.approval === 'epic' };
  }
  return { ref, auto: false };
}

const ticketIn = (app: AppState, project: string, id: string) =>
  app.projects.get(project)?.tickets.find((t) => t.id === id) ?? null;

// What a command said when it failed: its first lines.
const why = (r: CommandResult) =>
  (r.stderr || r.stdout).trim().split('\n').slice(0, 8).join('\n') || `exit ${r.code}`;

// Start the coder on a planned ticket: the tool makes its worktree and starts the coder there.
// From now on the ticket's own chat (it opens with what the ticket is) shows its progress.
export async function startTicket(
  app: AppState,
  project: string,
  id: string,
  from: ThreadRef,
  pressed = false,
): Promise<void> {
  const key = `${project}::run::${id}`;
  if (app.starting.has(key)) return;
  app.starting.add(key);
  const workflow = workflowOf(app, project);
  const ticket = ticketIn(app, project, id);
  const title = ticket?.title ?? id;
  try {
    if (pressed) record(app, from, [chatEntry(app, 'you', `Start the coder: ${title}`)]);
    if (ticket?.planned) return note(app, from, 'progress', `"${title}" has already started.`);
    const blocked = workflow.cannotRunAlone(project);
    if (blocked) return note(app, from, 'error', blocked);
    note(app, from, 'progress', `Making the worktree for "${title}". This can take a minute.`);
    const made = await workflow.startWork(project, id);
    if (made.code !== 0) {
      const text = `The worktree for "${title}" was not made:\n${why(made)}`;
      const retry = { kind: 'start' as const, label: 'Try again', value: id };
      return record(app, from, [{ ...chatEntry(app, 'error', text), actions: [retry] }]);
    }
    const ref = { project, thread: id };
    // glafka's own run line says the coder started; only a failure is said here.
    const coder = await workflow.startCoder(project, id);
    if (coder.code !== 0) note(app, ref, 'error', `The coder did not start:\n${why(coder)}`);
    // Started from its own chat: the coder's run lines follow here. Started elsewhere: point to it.
    if (from.thread !== id) {
      const open = { kind: 'open' as const, label: 'Open ticket chat', value: id };
      const text = `"${title}" has its own chat now. The coder works there.`;
      record(app, from, [{ ...chatEntry(app, 'progress', text), actions: [open] }]);
    }
    if (pressed && from.thread === PROJECT_THREAD) app.deps.post({ type: 'focus', ref });
  } catch (err) {
    note(app, from, 'error', messageOf(err));
  } finally {
    app.starting.delete(key);
    postSnapshot(app);
  }
  await refresh(app, project);
}
