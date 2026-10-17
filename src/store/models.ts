import path from 'node:path';
import { z } from 'zod';
import { threadKey, type ThreadRef } from '@/shared';
import { readJson, writeJson } from './files';

const FileSchema = z.record(z.string(), z.string());

// The model you picked for each chat. A chat with none uses the agent's default.
export function modelsStore(root: string) {
  const file = path.join(root, 'models.json');
  const all = () => readJson(file, FileSchema, {});
  return {
    all,
    get: (ref: ThreadRef): string | null => all()[threadKey(ref)] ?? null,
    set: (ref: ThreadRef, model: string) => writeJson(file, { ...all(), [threadKey(ref)]: model }),
  };
}
