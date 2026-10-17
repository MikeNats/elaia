import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSearch, projectDocs, threadDoc } from '@/search';

function project() {
  const root = mkdtempSync(path.join(tmpdir(), 'elaia-search-'));
  const ticket = path.join(root, 'docs', 'glafka', 'tickets', 't1');
  mkdirSync(ticket, { recursive: true });
  mkdirSync(path.join(root, 'docs', 'glafka', 'skills'), { recursive: true });
  writeFileSync(
    path.join(ticket, 'spec.md'),
    '# Add CSV export\n\nUsers download reports as CSV.\n',
  );
  writeFileSync(path.join(ticket, 'audit.jsonl'), '{"csv":"noise"}\n');
  writeFileSync(path.join(root, 'docs', 'glafka', 'skills', 'genesis.md'), '# csv in a skill\n');
  return root;
}

describe('search', () => {
  it('finds glafka docs by title and text, and skips installed skills and audits', () => {
    const root = project();
    const docs = projectDocs({ path: root, docsDir: path.join(root, 'docs', 'glafka') });
    expect(docs.map((d) => path.basename(d.path))).toEqual(['spec.md']);

    const search = createSearch();
    search.rebuild(docs);
    const [hit] = search.query('csv');
    expect(hit).toMatchObject({ project: root, title: 'Add CSV export' });
    expect(hit?.snippet).toContain('CSV');
  });

  it('finds words said in a chat thread', () => {
    const search = createSearch();
    search.rebuild([
      threadDoc({ project: '/p', thread: 't9' }, [
        {
          at: 'x',
          kind: 'agent',
          text: 'We picked Postgres COPY for speed.',
          shown: true,
          source: 'chat',
        },
        { at: 'x', kind: 'tool', text: 'Read — secret.ts', shown: false, source: 'chat' },
      ]),
    ]);
    expect(search.query('postgres')[0]).toMatchObject({ path: 'thread:t9', title: 'Thread t9' });
    expect(search.query('secret')).toEqual([]);
  });

  it('returns nothing before it is built', () => {
    expect(createSearch().query('csv')).toEqual([]);
  });
});
