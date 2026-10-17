import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { insideProject, projectDocs, threadDoc, walk, type Doc } from '@/search';
import { ThreadEntrySchema, type ThreadEntry } from '@/shared';
import type { Store } from '@/store';
import { chatsDir, elaiaDir } from './places';

export interface MemoryProject {
  path: string;
  // The ticket tool's docs folder (glafka: docs/glafka).
  docsDir: string;
}

function readThreadFile(file: string): ThreadEntry[] {
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line) => {
      try {
        const parsed = ThreadEntrySchema.safeParse(JSON.parse(line));
        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    });
}

// Chat files in the repo's .elaia/chats/, by chat name.
function repoThreads(project: MemoryProject): Map<string, string> {
  const dir = chatsDir(project.path);
  if (!existsSync(dir)) return new Map();
  const files = readdirSync(dir).filter((name) => name.endsWith('.jsonl'));
  return new Map(files.map((name) => [name.slice(0, -'.jsonl'.length), path.join(dir, name)]));
}

// One chat: this machine's copy when there is one (it is newer), else the repo's.
export function readThread(store: Store, project: MemoryProject, thread: string): ThreadEntry[] {
  const local = store.threads.read({ project: project.path, thread });
  if (local.length > 0) return local;
  const file = repoThreads(project).get(thread);
  return file ? readThreadFile(file) : [];
}

// Handoff notes, as docs: a short summary of a long chat is often the best hit.
function handoffDocs(project: MemoryProject): Doc[] {
  const dir = path.join(elaiaDir(project.path), 'handoffs');
  if (!insideProject(project.path, dir)) return [];
  return walk(dir).map((file) => {
    const rel = path.relative(project.path, file);
    const text = readFileSync(file, 'utf8');
    return { id: `${project.path}::${rel}`, project: project.path, path: file, title: rel, text };
  });
}

// Everything Elaia remembers about a project: written docs, handoff notes, then every chat.
export function memoryDocs(store: Store, project: MemoryProject): Doc[] {
  const names = new Set([...store.threads.list(project.path), ...repoThreads(project).keys()]);
  const chats = [...names].map((thread) =>
    threadDoc({ project: project.path, thread }, readThread(store, project, thread)),
  );
  return [...projectDocs(project), ...handoffDocs(project), ...chats];
}
