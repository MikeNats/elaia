import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// git as a test runs it: trimmed stdout, throws on a non-zero exit.
export const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

// A repo on main with one commit: αρχείο.md ("one") and old.md ("old"). Returns its folder.
export function makeRepo(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'elaia-git-'));
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(path.join(dir, 'αρχείο.md'), 'one\n');
  writeFileSync(path.join(dir, 'old.md'), 'old\n');
  git(dir, 'add', '.');
  git(dir, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'init');
  return dir;
}
