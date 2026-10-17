import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { changesSince } from '@/host/git';
import { git, makeRepo } from '../../support/gitRepo';

// No global or system git config: a user's core.quotePath=false must not hide the bug.
beforeAll(() => {
  vi.stubEnv('GIT_CONFIG_GLOBAL', '/dev/null');
  vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

describe('changesSince', () => {
  it('returns a Greek file name as it is, not quoted', async () => {
    const dir = makeRepo();
    writeFileSync(path.join(dir, 'αρχείο.md'), 'two\n');
    const { changes } = await changesSince(dir, 'main');
    expect(changes).toEqual([{ before: 'αρχείο.md', after: 'αρχείο.md' }]);
  });

  it('keeps Greek names on a rename and on a new untracked file', async () => {
    const dir = makeRepo();
    git(dir, 'mv', 'old.md', 'νέο.md');
    writeFileSync(path.join(dir, 'σημείωση.md'), 'note\n');
    const { changes } = await changesSince(dir, 'main');
    expect(changes).toEqual([
      { before: 'old.md', after: 'νέο.md' },
      { before: null, after: 'σημείωση.md' },
    ]);
  });

  it('tells which commit it compares against', async () => {
    const dir = makeRepo();
    const { from } = await changesSince(dir, 'main');
    expect(from).toBe(git(dir, 'rev-parse', 'HEAD'));
  });
});
