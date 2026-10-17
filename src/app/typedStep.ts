import { epicSlugOf, PROJECT_THREAD, todoOf, type ThreadRef } from '@/shared';
import { chatTurn } from './chat';
import { queueIfBusy } from './queue';
import { workflowOf } from './record';
import { closeTicket, push } from './ticketChat';
import type { AppState } from './types';

// A step typed alone in a ticket's chat ("lysis", "vima") is for this ticket. Elaia runs its own
// button for it, or asks the agent for exactly that one command, so no skill can take it over.
function typedStep(app: AppState, ref: ThreadRef, text: string): Promise<void> | null {
  const step = workflowOf(app, ref.project).typedStep(ref.thread, text);
  if (!step) return null;
  if (step.kind === 'close') return closeTicket(app, ref, text);
  if (step.kind === 'push') return push(app, ref, text);
  return chatTurn(app, ref, text, step.prompt);
}

// A message that gets no plain turn now: a step typed alone in a ticket's chat, or a busy chat
// (then it waits its turn).
export async function notNow(app: AppState, ref: ThreadRef, text: string): Promise<boolean> {
  const ticketChat =
    ref.thread !== PROJECT_THREAD && !epicSlugOf(ref.thread) && !todoOf(ref.thread);
  const step = ticketChat ? typedStep(app, ref, text) : null;
  if (step) return step.then(() => true);
  return queueIfBusy(app, ref, { text, prompt: null });
}
