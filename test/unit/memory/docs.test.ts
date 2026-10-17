import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { recall } from '@/memory/recall';
import { show } from '@/memory/show';
import { insideProject } from '@/search';
import { createStore } from '@/store';

const REFUSED = 'elaia show reads only files under docs/glafka/, docs/elaia/ or .elaia/handoffs/.';

// A repo with a secret and a README at its root, and no docs yet.
function repo(): string {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-docs-')));
  writeFileSync(path.join(root, '.env'), 'SECRET=hunter2\n');
  writeFileSync(path.join(root, 'README.md'), '# Readme\n\nzanzibarquux lives here.\n');
  return root;
}

const memoryProject = (root: string) => ({
  path: root,
  docsDir: path.join(root, 'docs', 'glafka'),
});
const store = () => createStore(mkdtempSync(path.join(tmpdir(), 'elaia-docs-store-')));
const read = (root: string, ref: string) => show(store(), memoryProject(root), ref, 0);

describe('docs folders', () => {
  it('refuses docs/glafka when it links back to the project', () => {
    const root = repo();
    mkdirSync(path.join(root, 'docs'));
    symlinkSync('..', path.join(root, 'docs', 'glafka'));
    const out = read(root, 'docs/glafka/.env');
    expect(out).toBe(REFUSED);
    expect(out).not.toContain('hunter2');
  });

  it('refuses a docs folder reached through a linked parent', () => {
    const root = repo();
    mkdirSync(path.join(root, 'notes', 'glafka'), { recursive: true });
    writeFileSync(path.join(root, 'notes', 'glafka', 'x.md'), '# x\n');
    symlinkSync('notes', path.join(root, 'docs'));
    expect(read(root, 'docs/glafka/x.md')).toBe(REFUSED);
  });

  it('refuses docs/elaia when it is a link', () => {
    const root = repo();
    mkdirSync(path.join(root, 'real-elaia'));
    writeFileSync(path.join(root, 'real-elaia', 'x.md'), '# x\n');
    mkdirSync(path.join(root, 'docs'));
    symlinkSync('../real-elaia', path.join(root, 'docs', 'elaia'));
    expect(read(root, 'docs/elaia/x.md')).toBe(REFUSED);
  });

  it('refuses .elaia/handoffs when .elaia is a link', () => {
    const root = repo();
    mkdirSync(path.join(root, 'elsewhere', 'handoffs'), { recursive: true });
    writeFileSync(path.join(root, 'elsewhere', 'handoffs', 'note.md'), '# note\n');
    symlinkSync('elsewhere', path.join(root, '.elaia'));
    expect(read(root, '.elaia/handoffs/note.md')).toBe(REFUSED);
  });

  // A guard, not a new rule: the project folder itself may be a link (/tmp on macOS).
  it('reads a real docs file when the project is reached through a link', () => {
    const root = repo();
    const spec = path.join(root, 'docs', 'glafka', 'tickets', 't1', 'spec.md');
    mkdirSync(path.dirname(spec), { recursive: true });
    writeFileSync(spec, '# Add CSV export\n');
    const linked = path.join(realpathSync(mkdtempSync(path.join(tmpdir(), 'elaia-link-'))), 'repo');
    symlinkSync(root, linked);
    expect(read(linked, 'docs/glafka/tickets/t1/spec.md')).toContain('# Add CSV export');
  });

  it('recall finds nothing through a docs link back to the project', () => {
    const root = repo();
    mkdirSync(path.join(root, 'docs'));
    symlinkSync('..', path.join(root, 'docs', 'glafka'));
    const out = recall({
      store: store(),
      projects: [memoryProject(root)],
      here: root,
      query: 'zanzibarquux',
      limit: 5,
    });
    expect(out).toBe('Nothing found for "zanzibarquux".');
  });

  it('insideProject: a real folder counts; the project root and a missing folder do not', () => {
    const root = repo();
    mkdirSync(path.join(root, 'docs', 'glafka'), { recursive: true });
    expect(insideProject(root, path.join(root, 'docs', 'glafka'))).toBe(true);
    expect(insideProject(root, root)).toBe(false);
    expect(insideProject(root, path.join(root, 'docs', 'elaia'))).toBe(false);
  });
});
