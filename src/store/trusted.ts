import path from 'node:path';
import { z } from 'zod';
import { readJson, writeJson } from './files';

// By project: the hash of what the repo could make run when you pressed Trust. The old format
// (a list of commands) does not parse, so each project is asked once more.
const FileSchema = z.record(z.string(), z.string());

export function trustedStore(root: string) {
  const file = path.join(root, 'trusted.json');
  const all = () => readJson(file, FileSchema, {});
  return {
    get: (project: string): string | null => all()[project] ?? null,
    set(project: string, hash: string): void {
      const current = all();
      if (current[project] !== hash) writeJson(file, { ...current, [project]: hash });
    },
  };
}
