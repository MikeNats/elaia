import path from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { threadKey, type ThreadRef } from '@/shared';
import { readJson, writeJson } from './files';

const SeenSchema = z.record(z.string(), z.string());

// When you last looked at each thread, so new messages since then can show a dot.
export function seenStore(root: string) {
  const file = path.join(root, 'seen.json');
  const all = () => readJson(file, SeenSchema, {});
  return {
    // False until Elaia has saved once: then nothing counts as new yet.
    exists: () => existsSync(file),
    get: (ref: ThreadRef): string | null => all()[threadKey(ref)] ?? null,
    all,
    mark: (refs: ThreadRef[], at: string) =>
      writeJson(file, { ...all(), ...Object.fromEntries(refs.map((r) => [threadKey(r), at])) }),
  };
}
