import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { ThreadRef } from '@/shared';
import { appendLines } from './files';
import { projectKey, safeName } from './keys';

// Raw agent output. glafka deletes its run logs at close, so we keep our own copy.
export function runsStore(root: string) {
  const dir = (ref: ThreadRef) =>
    path.join(root, 'raw', projectKey(ref.project), safeName(ref.thread));
  return {
    dir,
    // Every line a chat turn printed, unfiltered.
    appendChat(ref: ThreadRef, lines: string[]): void {
      appendLines(path.join(dir(ref), 'chat.log'), lines);
    },
    // Copies a finished glafka run once. Returns false when it was already copied.
    copy(ref: ThreadRef, role: string, startedAt: string, source: string): boolean {
      const target = path.join(dir(ref), `${safeName(role)}-${safeName(startedAt)}.log`);
      if (existsSync(target)) return false;
      mkdirSync(path.dirname(target), { recursive: true });
      copyFileSync(source, target);
      return true;
    },
  };
}
