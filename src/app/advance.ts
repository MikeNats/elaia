import type { NextStep } from '@/workflow';
import type { ThreadEntry } from '@/shared';
import { noteAgent } from './liveAgents';
import { explainStop, stopMoved } from './nextStep';
import { messageOf, note, record, workflowOf } from './record';
import { refresh } from './refresh';
import type { AppState } from './types';

// The "agent" that stands for glafka's own step in the right panel.
const STEP = 'glafka-vima';

// vima can run for many minutes (checks, e2e), so it runs outside the refresh, once per ticket.
// After the coder it runs the checks first, which can be slow: the chat says so. While it runs
// it shows as a running agent (⏳ in the tree).
export async function autoAdvance(app: AppState, projectPath: string, id: string, roles: string[]) {
  const key = `${projectPath}::${id}`;
  if (app.advancing.has(key)) return;
  app.advancing.add(key);
  const ref = { project: projectPath, thread: id };
  if (roles.includes('coder'))
    note(
      app,
      ref,
      'progress',
      'Next, glafka runs the checks, then QA and the review. This can take a few minutes.',
    );
  noteAgent(app, ref, { kind: 'agent-start', id: STEP, about: 'glafka: next step' });
  noteAgent(app, ref, {
    kind: 'agent-step',
    id: STEP,
    doing: roles.includes('coder') ? 'running the checks' : 'starting the next step',
  });
  try {
    await advance(app, projectPath, id);
  } finally {
    app.advancing.delete(key);
    noteAgent(app, ref, { kind: 'agent-end', id: STEP });
  }
  await refresh(app, projectPath);
}

// glafka's next step, in plain words. "ready" says nothing here: the Ready card says it.
function plain(r: NextStep, at: string): ThreadEntry | null {
  const line = (kind: ThreadEntry['kind'], text: string, shown = true): ThreadEntry => ({
    at,
    kind,
    text,
    shown,
    source: 'glafka',
  });
  switch (r.action) {
    case 'spawned-verifier':
      return line('progress', 'QA started: it checks each acceptance criterion.');
    case 'spawned-reviewer':
      return line('progress', 'Review started.');
    case 'spawned-coder':
      return line(
        'progress',
        `Review found issues: the coder is fixing them.${r.reason ? ` (${r.reason})` : ''}`,
      );
    case 'error':
      return line(
        'error',
        `glafka could not take the next step${r.reason ? `: ${r.reason}` : '.'}`,
      );
    default:
      return line('progress', `Next step: ${r.action}${r.reason ? ` — ${r.reason}` : ''}`, false);
  }
}

// Let glafka take the next step (start QA or the reviewer, send findings back…). It never pushes.
export async function advance(app: AppState, projectPath: string, id: string): Promise<void> {
  const ref = { project: projectPath, thread: id };
  try {
    const results = await workflowOf(app, projectPath).advance(projectPath, id);
    record(
      app,
      ref,
      results.flatMap((r) => plain(r, app.deps.now()) ?? []),
    );
    const stuck = results.find(waitsForYou);
    if (stuck) explainStop(app, ref, stuck.reason ?? stuck.action);
  } catch (err) {
    note(app, ref, 'error', messageOf(err));
    explainStop(app, ref, messageOf(err));
  }
}

// You pressed next step: the ticket moves, so a stop after it is explained again.
export async function advanceByHand(app: AppState, projectPath: string, id: string) {
  stopMoved(app, { project: projectPath, thread: id });
  await advance(app, projectPath, id);
}

// glafka did nothing because you must act, or failed: the chat must not just go quiet.
const waitsForYou = (r: NextStep) =>
  r.action === 'error' || (r.action === 'none' && /needs you|review manually/.test(r.reason ?? ''));
