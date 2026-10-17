import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStore } from '@/store';

describe('store.trusted', () => {
  it('keeps one hash per project', () => {
    const store = createStore(mkdtempSync(path.join(tmpdir(), 'elaia-trusted-')));
    expect(store.trusted.get('/repo')).toBeNull();
    store.trusted.set('/repo', 'abc');
    store.trusted.set('/other', 'def');
    expect(store.trusted.get('/repo')).toBe('abc');
    expect(store.trusted.get('/other')).toBe('def');
  });

  it('reads the old format (a list of commands) as nothing trusted', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'elaia-trusted-old-'));
    writeFileSync(path.join(root, 'trusted.json'), JSON.stringify({ '/repo': ['claude -p'] }));
    expect(createStore(root).trusted.get('/repo')).toBeNull();
  });
});
