import { threadKey, type ThreadRef } from '@/shared';
import { chatTurn } from './chat';
import { workflowOf } from './record';
import type { AppState } from './types';

// The ticket tool stopped and waits for you: the ticket's agent says why and what is next.
// Once per stop, so the tool's two ways of saying it do not ask twice.
export function explainStop(app: AppState, ref: ThreadRef, reason: string): void {
  const key = threadKey(ref);
  if (app.explainedStops.has(key)) return;
  app.explainedStops.add(key);
  void chatTurn(app, ref, '', stopPrompt(workflowOf(app, ref.project).name, reason));
}

// A run ended or you pressed next step: the ticket moved, so its next stop is explained again.
export function stopMoved(app: AppState, ref: ThreadRef): void {
  app.explainedStops.delete(threadKey(ref));
}

const stopPrompt = (tool: string, reason: string) =>
  [
    `${tool} stopped this ticket and waits for the user. Its reason: "${reason}".`,
    'Find out why: read the ticket state and the failure output. Change nothing.',
    'Then tell the user in short plain words: what happened (one line), the next step, and who does it.',
    'End with what the user can choose, as `Choices: a | b`.',
  ].join('\n');
