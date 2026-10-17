import path from 'node:path';
import { z } from 'zod';
import { readJson, writeJson } from './files';

// Commands from a repo's own settings that you said yes to, by project. A cloned repo could put
// anything in its settings, so none of them runs before you saw it once.
const FileSchema = z.record(z.string(), z.array(z.string()));

export function trustedStore(root: string) {
  const file = path.join(root, 'trusted.json');
  const all = () => readJson(file, FileSchema, {});
  return {
    has: (project: string, command: string) => (all()[project] ?? []).includes(command),
    add(project: string, command: string): void {
      const current = all();
      const list = current[project] ?? [];
      if (!list.includes(command)) writeJson(file, { ...current, [project]: [...list, command] });
    },
  };
}
