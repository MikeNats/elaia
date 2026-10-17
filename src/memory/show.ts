import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { elaiaDocs } from '@/epics';
import type { ThreadEntry } from '@/shared';
import type { Store } from '@/store';
import { insideProject } from '@/search';
import { readThread, type MemoryProject } from './library';
import { elaiaDir } from './places';

const PAGE = 12_000;

const speaker = (e: ThreadEntry) =>
  e.kind === 'you' ? 'You' : e.source === 'glafka' ? 'Elaia' : 'Agent';

// Pages of one item, so a long chat never floods the agent's context.
function page(items: string[], from: number, more: (next: number) => string): string {
  const out: string[] = [];
  let size = 0;
  let i = from;
  for (; i < items.length && (out.length === 0 || size + items[i]!.length <= PAGE); i++) {
    out.push(items[i]!);
    size += items[i]!.length;
  }
  if (i < items.length) out.push('', `… ${items.length - i} more. Next page: ${more(i)}`);
  return out.join('\n');
}

// One chat (`thread:<name>`) or one file, from line or message `from`.
export function show(store: Store, project: MemoryProject, ref: string, from: number): string {
  const more = (next: number) => `elaia show ${JSON.stringify(ref)} --from ${next}`;
  if (ref.startsWith('thread:')) {
    const entries = readThread(store, project, ref.slice('thread:'.length)).filter((e) => e.shown);
    if (entries.length === 0) return `No chat called ${ref} in ${project.path}.`;
    const items = entries.map((e) => `[${speaker(e)} ${e.at.slice(0, 16)}] ${e.text.trim()}`);
    return page(items, from, more);
  }
  const file = path.resolve(project.path, ref);
  if (!existsSync(file)) return `No file ${ref} in ${project.path}.`;
  // Every chat may run this without asking, so it reads only the docs that recall searches.
  // Real paths, so a link inside docs/ cannot point outside.
  const handoffs = path.join(elaiaDir(project.path), 'handoffs');
  const roots = [project.docsDir, elaiaDocs(project.path), handoffs].filter((r) =>
    insideProject(project.path, r),
  );
  const real = realpathSync(file);
  if (!roots.some((root) => real.startsWith(`${realpathSync(root)}${path.sep}`)))
    return 'elaia show reads only files under docs/glafka/, docs/elaia/ or .elaia/handoffs/.';
  return page(readFileSync(file, 'utf8').split('\n'), from, more);
}
