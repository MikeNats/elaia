import { describe, expect, it } from 'vitest';
import { allowRule, splitRules } from '@/agents/allowRule';

const bash = (command: string) => allowRule('Bash', { command });

describe('allowRule', () => {
  it('saves program and subcommand', () => {
    expect(bash('git commit -m x')).toBe('Bash(git commit:*)');
  });

  it('gives a rule for every command of a long chain', () => {
    const chain =
      'cd /repo && npm run build && npm test -- --coverage && git add -A && ' +
      'git commit -m "feat: block other spellings of risky commands in auto mode!" && ' +
      'node scripts/check.mjs && make lint';
    expect(chain).toHaveLength(183);
    expect(bash(chain)).toBe(
      'Bash(npm run:*),Bash(npm test:*),Bash(git add:*),Bash(git commit:*),' +
        'Bash(node scripts/check.mjs),Bash(make lint:*)',
    );
  });

  it.each([
    'sh -c "npm test"',
    'bash -c "git push"',
    'zsh -c "ls"',
    'env FOO=1 npm test',
    'xargs -n1 rm',
    'node scripts/x.mjs',
    'python -m pytest',
    'python3 -m pytest',
    'npx vitest run',
    'sudo ls',
    'eval "$X"',
    'exec npm test',
    'bunx vitest',
    'deno run x.ts',
    'ruby x.rb',
    'perl x.pl',
    'npm exec vitest',
    'pnpm dlx create-x',
    'yarn dlx create-x',
  ])('allows only the exact command for %s', (command) => {
    expect(bash(command)).toBe(`Bash(${command})`);
  });

  it.each([
    ['timeout 30 npm test', 'Bash(npm test:*)'],
    ['nohup npm run dev', 'Bash(npm run:*)'],
    ['nice -n 10 make build', 'Bash(make build:*)'],
    ['FOO=1 npm test', 'Bash(FOO=1 npm test)'],
    ['ls -la', 'Bash(ls -la)'],
    ['cat a.md', 'Bash(cat a.md)'],
    ['make', 'Bash(make)'],
    ['/usr/bin/git commit -m x', 'Bash(/usr/bin/git commit -m x)'],
    ['cd /x', 'Bash(cd /x)'],
    ['git commit -m "a && b; c | d"', 'Bash(git commit:*)'],
    ['npm test 2>&1 | tee out.log', 'Bash(npm test:*),Bash(tee out.log)'],
  ])('%s gives %s', (command, rule) => {
    expect(bash(command)).toBe(rule);
  });

  it('names any other tool as it is', () => {
    expect(allowRule('Write', { file_path: 'a.ts' })).toBe('Write');
  });
});

describe('splitRules', () => {
  it('keeps a comma inside ( ) in its rule', () => {
    expect(splitRules('Bash(sh -c "echo a, b"),Bash(npm test:*)')).toEqual([
      'Bash(sh -c "echo a, b")',
      'Bash(npm test:*)',
    ]);
  });

  it('keeps a bracket inside quotes in its rule', () => {
    expect(splitRules('Bash(echo "("),Read')).toEqual(['Bash(echo "(")', 'Read']);
  });

  it('splits plain rules as before', () => {
    expect(splitRules('Skill,Bash(npm:*)')).toEqual(['Skill', 'Bash(npm:*)']);
  });
});
