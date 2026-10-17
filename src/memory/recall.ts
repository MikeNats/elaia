import path from 'node:path';
import { createSearch } from '@/search';
import type { Store } from '@/store';
import { memoryDocs, type MemoryProject } from './library';

export interface RecallOptions {
  store: Store;
  projects: MemoryProject[];
  // The project the agent works in, or null to say which project each hit is from.
  here: string | null;
  query: string;
  limit: number;
}

const refOf = (project: string, file: string) =>
  file.startsWith('thread:') ? file : path.relative(project, file);

// Search every doc and chat of the given projects; print the best hits and how to read each.
export function recall(opts: RecallOptions): string {
  const search = createSearch();
  search.rebuild(opts.projects.flatMap((p) => memoryDocs(opts.store, p)));
  const hits = search.query(opts.query).slice(0, opts.limit);
  if (hits.length === 0) return `Nothing found for "${opts.query}".`;
  const where = opts.here ? ` in ${path.basename(opts.here)}` : ' in every project';
  const count = hits.length === 1 ? '1 result' : `${hits.length} results`;
  const lines = [`${count} for "${opts.query}"${where}:`, ''];
  hits.forEach((hit, i) => {
    const ref = refOf(hit.project, hit.path);
    const from = opts.here === hit.project ? '' : ` --project ${JSON.stringify(hit.project)}`;
    lines.push(`${i + 1}. ${hit.title}${opts.here ? '' : ` (${path.basename(hit.project)})`}`);
    lines.push(`   ${hit.snippet}`);
    lines.push(`   read: elaia show ${JSON.stringify(ref)}${from}`, '');
  });
  return lines.join('\n');
}
