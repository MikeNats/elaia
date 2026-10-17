import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ThreadEntrySchema, type ThreadEntry, type ThreadRef } from '@/shared';
import { appendLines, readLines } from './files';
import { projectKey, safeName } from './keys';

export function threadsStore(root: string) {
  const file = (ref: ThreadRef) =>
    path.join(root, 'threads', projectKey(ref.project), `${safeName(ref.thread)}.jsonl`);
  const read = (ref: ThreadRef): ThreadEntry[] => readLines(file(ref), ThreadEntrySchema);
  return {
    file,
    read,
    // Every thread kept for a project, open tickets and closed ones.
    list(project: string): string[] {
      const dir = path.join(root, 'threads', projectKey(project));
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((name) => name.endsWith('.jsonl'))
        .map((name) => name.slice(0, -'.jsonl'.length));
    },
    // A changed file under the store root back to its thread, when its project is one of these.
    refOf(relativePath: string, projects: string[]): ThreadRef | null {
      const [top, key, name, ...rest] = relativePath.split('/');
      if (top !== 'threads' || !key || !name?.endsWith('.jsonl') || rest.length > 0) return null;
      const project = projects.find((p) => projectKey(p) === key);
      return project ? { project, thread: name.slice(0, -'.jsonl'.length) } : null;
    },
    append(ref: ThreadRef, entries: ThreadEntry[]): void {
      appendLines(
        file(ref),
        entries.map((e) => JSON.stringify(e)),
      );
    },
    // The last shown entries: what a new session needs to pick up the thread.
    tail(ref: ThreadRef, count: number): ThreadEntry[] {
      return read(ref)
        .filter((e) => e.shown)
        .slice(-count);
    },
  };
}
