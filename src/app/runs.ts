import type { FinishedRun } from '@/workflow';
import type { ThreadEntry } from '@/shared';
import { record, workflowOf } from './record';
import type { AppState } from './types';
import { noteRun } from './usage';

const REPORT_MAX = 6000;
const NAMES: Record<string, string> = { coder: 'Coder', verifier: 'QA', reviewer: 'Review' };

// One short line you see ("QA finished."); the run's own report sits behind "Show details".
function endEntries(run: FinishedRun, said: string | null, at: string): ThreadEntry[] {
  const ok = run.exitCode === 0;
  const name = NAMES[run.role] ?? run.role;
  const line: ThreadEntry = {
    at,
    kind: ok ? 'progress' : 'finding',
    text: ok ? `${name} finished.` : `${name} stopped with an error (exit ${run.exitCode ?? '?'}).`,
    shown: true,
    source: 'glafka',
  };
  if (!said?.trim()) return [line];
  const report = said.trim().slice(0, REPORT_MAX);
  return [line, { at, kind: 'progress', text: report, shown: false, source: 'glafka' }];
}

// Copies every finished background run once, before the tool deletes it. A copy is also how a run's
// end is noticed: its exit-code file appeared. Returns the roles of the runs that ended since the last look.
export function copyRuns(
  app: AppState,
  projectPath: string,
  ticketId: string,
  announce: boolean,
): string[] {
  const ref = { project: projectPath, thread: ticketId };
  const ended: string[] = [];
  const workflow = workflowOf(app, projectPath);
  for (const run of workflow.finishedRuns(projectPath, ticketId)) {
    if (!app.deps.store.runs.copy(ref, run.role, run.startedAt, run.log)) continue;
    // The first look at a ticket copies old runs quietly; they are history, not news.
    if (!announce) continue;
    ended.push(run.role);
    record(app, ref, endEntries(run, workflow.lastWords(run.log), app.deps.now()));
    noteRun(app, ref, run.log);
  }
  return ended;
}
