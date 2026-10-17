import { describe, expect, it } from 'vitest';
import { blockedBy } from '../support/claudeRules';

// Rows from the wildcard table and the examples in Claude's permissions docs.
describe("the test copy of Claude's rule matching", () => {
  it.each([
    ['Bash(npm run build)', 'npm run build', true],
    ['Bash(npm run build)', 'npm run build --watch', false],
    ['Bash(npm run *)', 'npm run', true],
    ['Bash(npm run *)', 'npm install', false],
    ['Bash(git * main)', 'git push origin main', true],
    ['Bash(git * main)', 'git log', false],
    ['Bash(* --version)', 'node --version', true],
    ['Bash(* --version)', 'node -v', false],
    ['Bash(ls *)', 'ls', true],
    ['Bash(ls *)', 'lsof', false],
    ['Bash(ls*)', 'lsof', true],
    ['Bash(* --help *)', 'npm --help x', true],
    ['Bash(* --help *)', 'npm --help', false],
    ['Bash(ls:*)', 'ls -la', true],
    ['Bash(rm *)', 'FOO=bar rm -rf tmp/', true],
    ['Bash(rm *)', 'cd /tmp && rm -rf x', true],
    ['Bash(git push *)', 'git -C . push origin main', false],
    ['Edit(.glafka/**)', 'git push', false],
  ] as const)('%s on %s: %s', (rule, command, blocked) => {
    expect(blockedBy([rule], command)).toBe(blocked);
  });
});
