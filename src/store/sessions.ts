import path from 'node:path';
import { z } from 'zod';
import { threadKey, type ThreadRef } from '@/shared';
import { readJson, writeJson } from './files';

// Per thread: one agent session per folder, plus the tools you allowed.
const ThreadSessionsSchema = z.object({
  byFolder: z.record(z.string(), z.string()),
  allowed: z.array(z.string()),
});
const FileSchema = z.record(z.string(), ThreadSessionsSchema);
type ThreadSessions = z.infer<typeof ThreadSessionsSchema>;

export function sessionsStore(root: string) {
  const file = path.join(root, 'sessions.json');
  const all = () => readJson(file, FileSchema, {});
  const one = (ref: ThreadRef): ThreadSessions =>
    all()[threadKey(ref)] ?? { byFolder: {}, allowed: [] };
  const save = (ref: ThreadRef, value: ThreadSessions) =>
    writeJson(file, { ...all(), [threadKey(ref)]: value });

  return {
    get(ref: ThreadRef, folder: string): string | null {
      return one(ref).byFolder[folder] ?? null;
    },
    set(ref: ThreadRef, folder: string, sessionId: string): void {
      const current = one(ref);
      save(ref, { ...current, byFolder: { ...current.byFolder, [folder]: sessionId } });
    },
    // A session that can no longer be resumed. The next turn starts a fresh one.
    forget(ref: ThreadRef, folder: string): void {
      const current = one(ref);
      const byFolder = { ...current.byFolder };
      delete byFolder[folder];
      save(ref, { ...current, byFolder });
    },
    allowed(ref: ThreadRef): string[] {
      return one(ref).allowed;
    },
    allow(ref: ThreadRef, rule: string): void {
      const current = one(ref);
      if (!current.allowed.includes(rule))
        save(ref, { ...current, allowed: [...current.allowed, rule] });
    },
  };
}
