import { threadKey, type ThreadRef } from '@/shared';
import type { AppState } from './types';

// This window wrote `count` lines to a thread and showed them, so its own file change needs no
// second post. The first time, the file says how many lines there are: they are already written.
export function knowWritten(app: AppState, ref: ThreadRef, count: number): void {
  const key = threadKey(ref);
  const known = app.known.get(key);
  app.known.set(key, known === undefined ? app.deps.store.threads.read(ref).length : known + count);
}
