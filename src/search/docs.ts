import { existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { elaiaDocs } from '@/epics';
import type { ThreadEntry, ThreadRef } from '@/shared';

export interface Doc {
  id: string;
  project: string;
  // A file path, or `thread:<name>` for a chat thread.
  path: string;
  title: string;
  text: string;
}

const MAX_BYTES = 1024 * 1024;
// Installed skill copies are the same in every repo; audits are numbers, not words.
const SKIP_DIRS = new Set(['skills', 'node_modules']);
// Words people wrote: Markdown, and the epic files Elaia runs.
const wanted = (name: string) => name.endsWith('.md') || name === 'epic.json';

export function walk(dir: string, want: (name: string) => boolean = wanted): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    // A link could point anywhere on the machine; search reads only real files here.
    if (e.isSymbolicLink()) return [];
    if (e.isDirectory()) return SKIP_DIRS.has(e.name) ? [] : walk(full, want);
    return want(e.name) && statSync(full).size <= MAX_BYTES ? [full] : [];
  });
}

// A docs folder counts only when no link sits between the project and it: a link could point
// back at the project (docs/glafka -> ..) or anywhere on the machine, and every chat may read
// these docs without asking. The project folder itself may be a link (/tmp on macOS).
export function insideProject(project: string, dir: string): boolean {
  if (!existsSync(dir)) return false;
  const rel = path.relative(project, dir);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return realpathSync(dir) === path.join(realpathSync(project), rel);
}

const titleOf = (text: string, fallback: string) =>
  text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fallback;

// Every written doc in one project: the ticket tool's (specs, plans, decisions, the map)
// and Elaia's (epics, handoff notes).
export function projectDocs(project: { path: string; docsDir: string }): Doc[] {
  const roots = [project.docsDir, elaiaDocs(project.path)];
  return roots
    .filter((root) => insideProject(project.path, root))
    .flatMap((root) => walk(root))
    .map((file) => {
      const text = readFileSync(file, 'utf8');
      const rel = path.relative(project.path, file);
      return {
        id: `${project.path}::${rel}`,
        project: project.path,
        path: file,
        title: titleOf(text, rel),
        text,
      };
    });
}

// A chat thread as one document. Only what was shown: tool work stays out of search.
export function threadDoc(ref: ThreadRef, entries: ThreadEntry[]): Doc {
  return {
    id: `${ref.project}::thread::${ref.thread}`,
    project: ref.project,
    path: `thread:${ref.thread}`,
    title: `Thread ${ref.thread}`,
    text: entries
      .filter((e) => e.shown)
      .map((e) => e.text)
      .join('\n'),
  };
}
