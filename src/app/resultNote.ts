import type { ThreadEntry, ThreadRef } from '@/shared';
import type { CommandResult } from '@/workflow';
import { record } from './record';
import type { AppState } from './types';

// One line you see; the command's own output as a text box: in the details when it worked,
// shown when it failed.
export function resultNote(
  app: AppState,
  ref: ThreadRef,
  ok: string,
  failed: string,
  result: CommandResult,
) {
  const worked = result.code === 0;
  const tail = (result.stdout + result.stderr).trim().split('\n').slice(-12).join('\n');
  const line = (kind: ThreadEntry['kind'], text: string, shown: boolean): ThreadEntry => ({
    at: app.deps.now(),
    kind,
    text,
    shown,
    source: 'glafka',
  });
  record(app, ref, [
    line(worked ? 'progress' : 'error', worked ? ok : failed, true),
    ...(tail ? [line('progress', `\`\`\`text\n${tail}\n\`\`\``, !worked)] : []),
  ]);
}
