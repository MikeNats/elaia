import { readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { baseQuery, baseText, changesSince } from '@/host/git';
import type { ThreadRef } from '@/shared';
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

describe('baseText', () => {
  const ticket = { project: '/repo', thread: 'T1' };

  it('reads a file as it was at a commit', async () => {
    const dir = makeRepo();
    const sha = git(dir, 'rev-parse', 'HEAD');
    writeFileSync(path.join(dir, 'αρχείο.md'), 'two\n');
    expect(await baseText(baseQuery(ticket, sha), 'αρχείο.md', () => dir)).toBe('one\n');
  });

  it('refuses a ref that git would read as an option', async () => {
    const dir = makeRepo();
    expect(await baseText(baseQuery(ticket, '--output=x'), 'αρχείο.md', () => dir)).toBe('');
    expect(readdirSync(dir).filter((name) => name.startsWith('x'))).toEqual([]);
  });

  it('refuses a ref that is not a full commit id', async () => {
    const dir = makeRepo();
    expect(await baseText(baseQuery(ticket, 'HEAD'), 'αρχείο.md', () => dir)).toBe('');
    expect(await baseText(baseQuery(ticket, ''), 'αρχείο.md', () => dir)).toBe('');
  });

  it('reads nothing for a ticket Elaia does not know', async () => {
    const dir = makeRepo();
    const sha = git(dir, 'rev-parse', 'HEAD');
    const worktreeOf = vi.fn((_ticket: ThreadRef): string | null => null);
    expect(await baseText(baseQuery(ticket, sha), 'αρχείο.md', worktreeOf)).toBe('');
    expect(worktreeOf).toHaveBeenCalledWith(ticket);
  });

  it('never takes the folder from the link', async () => {
    const dir = makeRepo();
    const sha = git(dir, 'rev-parse', 'HEAD');
    const oldShape = JSON.stringify({ worktree: dir, ref: sha });
    const extraField = JSON.stringify({ ...ticket, ref: sha, worktree: dir });
    expect(await baseText(oldShape, 'αρχείο.md', () => dir)).toBe('');
    expect(await baseText(extraField, 'αρχείο.md', () => dir)).toBe('');
    expect(await baseText('not json', 'αρχείο.md', () => dir)).toBe('');
  });
});
