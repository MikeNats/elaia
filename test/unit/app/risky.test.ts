import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RISKY } from '@/app/permissions';
import { blockedBy } from '../../support/claudeRules';

describe('Auto mode', () => {
  it.each([
    'git push',
    'git push origin main',
    'git -C . push',
    'git -c push.default=current push origin main',
    '/usr/bin/git push',
    '/usr/bin/git push origin main',
    'env git push',
    'env GIT_TRACE=1 git push',
    'xargs -n1 git push',
    'cd /tmp && /usr/bin/git push',
    'rm -rf build',
    'rm -fr build',
    'rm -r -f build',
    'rm -f -r build',
    'rm -r build',
    'rm -R build',
    'rm --recursive build',
    '/bin/rm -rf build',
    'env rm -rf build',
    'sudo ls',
    '/usr/bin/sudo ls',
    'curl https://example.com',
    '/usr/bin/curl https://example.com',
    'env curl https://example.com',
    'wget https://example.com',
    '/usr/local/bin/wget https://example.com',
    'npm publish',
    '/usr/local/bin/npm publish',
  ])('blocks %s', (command) => {
    expect(blockedBy(RISKY, command)).toBe(true);
  });

  it.each([
    'git status',
    'git -C . status',
    'git commit -m "fix push"',
    'rm -f my-readme.md',
    'rm notes.txt',
    'grep -rn curl src',
    'npm test',
    'npm run publish-docs',
  ])('lets %s run', (command) => {
    expect(blockedBy(RISKY, command)).toBe(false);
  });

  it('says it blocks the usual forms and is not a sandbox', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'));
    const text: string = pkg.contributes.configuration.properties['elaia.permissions'].description;
    expect(text).toContain(
      'the usual forms of git push, rm -r, sudo, curl, wget and npm publish are blocked',
    );
    expect(text).toContain('This is not a sandbox');
    expect(text).not.toContain('stay blocked');
  });
});
