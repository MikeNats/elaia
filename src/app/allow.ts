import { EDIT_TOOLS } from '@/agents';
import type { ThreadEntry, ThreadRef } from '@/shared';
import { coderWorking } from './agent';
import { send } from './chat';
import { record } from './record';
import type { AppState } from './types';

const chatEntry = (app: AppState, kind: ThreadEntry['kind'], text: string): ThreadEntry => ({
  at: app.deps.now(),
  kind,
  text,
  shown: true,
  source: 'chat',
});

const isEditTool = (rule: string) => (EDIT_TOOLS as readonly string[]).includes(rule);

// You allowed a tool the agent was refused. Remember it for this thread, and let it carry on.
export async function allow(app: AppState, ref: ThreadRef, rule: string): Promise<void> {
  if (coderWorking(app, ref) && !rule.split(',').some((r) => isEditTool(r))) {
    app.deps.store.sessions.allow(ref, rule);
    record(app, ref, [
      chatEntry(app, 'you', `Allowed ${rule}.`),
      chatEntry(
        app,
        'progress',
        'Saved. While the coder works this chat can only read, so it applies once the coder finishes.',
      ),
    ]);
    return;
  }
  if (coderWorking(app, ref)) {
    record(app, ref, [
      chatEntry(app, 'you', `Allowed ${rule}.`),
      chatEntry(
        app,
        'error',
        'Edits stay blocked while the coder works in this ticket. Allow it again once the coder has finished.',
      ),
    ]);
    return;
  }
  app.deps.store.sessions.allow(ref, rule);
  await send(app, ref, `Allowed ${rule}. Please continue.`);
}
