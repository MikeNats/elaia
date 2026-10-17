import MiniSearch from 'minisearch';
import type { SearchHit } from '@/shared';
import type { Doc } from './docs';

const LIMIT = 30;
const SNIPPET = 200;

// The line with the most search words (headings skipped), cut around the first word found.
function snippet(text: string, terms: string[]): string {
  const lower = terms.map((t) => t.toLowerCase());
  const lines = text.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const score = (l: string) => lower.filter((t) => l.toLowerCase().includes(t)).length;
  const best = lines.reduce((a, b) => (score(b) > score(a) ? b : a), lines[0] ?? text);
  const flat = best.replace(/\s+/g, ' ').trim();
  const found = lower.map((t) => flat.toLowerCase().indexOf(t)).filter((i) => i >= 0);
  const start = Math.max(0, Math.min(...found, flat.length) - 60);
  const cut = flat.slice(start, start + SNIPPET);
  return `${start > 0 ? '…' : ''}${cut}${start + SNIPPET < flat.length ? '…' : ''}`;
}

// An in-memory index. It is rebuilt from the repos and threads, so it is never saved.
export function createSearch() {
  let index: MiniSearch<Doc> | null = null;
  let docs = new Map<string, Doc>();
  return {
    ready: () => index !== null,
    rebuild(all: Doc[]): void {
      index = new MiniSearch<Doc>({
        fields: ['title', 'text'],
        searchOptions: { prefix: true, fuzzy: 0.2, boost: { title: 2 } },
      });
      index.addAll(all);
      docs = new Map(all.map((d) => [d.id, d]));
    },
    query(text: string): SearchHit[] {
      if (!index || !text.trim()) return [];
      return index
        .search(text)
        .slice(0, LIMIT)
        .flatMap((result) => {
          const doc = docs.get(String(result.id));
          if (!doc) return [];
          return [
            {
              project: doc.project,
              path: doc.path,
              title: doc.title,
              snippet: snippet(doc.text, result.terms),
            },
          ];
        });
    },
  };
}

export type Search = ReturnType<typeof createSearch>;
