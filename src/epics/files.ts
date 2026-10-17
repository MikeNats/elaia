import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { EpicSchema, type Epic } from './schema';

// Elaia's own folder in a repo: the same for every ticket tool.
export const elaiaDocs = (project: string) => path.join(project, 'docs', 'elaia');
export const epicsDir = (project: string) => path.join(elaiaDocs(project), 'epics');
export const inboxDir = (project: string) => path.join(elaiaDocs(project), 'inbox');
export const epicFile = (project: string, slug: string) =>
  path.join(epicsDir(project), slug, 'epic.json');

export interface EpicRead {
  slug: string;
  epic: Epic | null;
  // Set when epic.json is not valid: what is wrong, in words for the planner.
  problem: string | null;
}

export function readEpics(project: string): EpicRead[] {
  const dir = epicsDir(project);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(epicFile(project, e.name)))
    .map((e) => readEpic(project, e.name));
}

export function readEpic(project: string, slug: string): EpicRead {
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(epicFile(project, slug), 'utf8'));
  } catch (err) {
    return { slug, epic: null, problem: `not JSON: ${err instanceof Error ? err.message : err}` };
  }
  const parsed = EpicSchema.safeParse(json);
  if (parsed.success) return { slug, epic: parsed.data, problem: null };
  const problem = parsed.error.issues
    .map((i) => `${i.path.join('.') || 'epic'}: ${i.message}`)
    .join('; ');
  return { slug, epic: null, problem };
}

// Write then rename, so the planner or a person never reads half a file.
export function writeEpic(project: string, slug: string, epic: Epic): void {
  const file = epicFile(project, slug);
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(epic, null, 2)}\n`);
  renameSync(temp, file);
}

// Read, change, write in one go, so two writers never undo each other's work.
export function updateEpic(
  project: string,
  slug: string,
  change: (epic: Epic) => Epic,
): Epic | null {
  const read = readEpic(project, slug);
  if (!read.epic) return null;
  const next = change(read.epic);
  writeEpic(project, slug, next);
  return next;
}
