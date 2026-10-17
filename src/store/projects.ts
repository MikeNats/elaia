import path from 'node:path';
import { z } from 'zod';
import { readJson, writeJson } from './files';

const ProjectEntrySchema = z.object({ path: z.string(), name: z.string() });
export type ProjectEntry = z.infer<typeof ProjectEntrySchema>;
const ListSchema = z.array(ProjectEntrySchema);

export function projectsStore(root: string) {
  const file = path.join(root, 'projects.json');
  const list = (): ProjectEntry[] => readJson(file, ListSchema, []);
  return {
    list,
    add(projectPath: string): ProjectEntry {
      const entry = { path: projectPath, name: path.basename(projectPath) };
      const current = list();
      if (!current.some((p) => p.path === projectPath)) writeJson(file, [...current, entry]);
      return entry;
    },
    remove(projectPath: string): void {
      writeJson(
        file,
        list().filter((p) => p.path !== projectPath),
      );
    },
  };
}
