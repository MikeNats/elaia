import { describe, expect, it } from 'vitest';
import { headsOf, spellings } from '@/agents';

describe('spellings', () => {
  it('names a program by name, by a path, after env and after xargs', () => {
    expect(headsOf('git')).toEqual(['git', '*/git', 'env *git', 'xargs *git']);
  });

  it('puts the same rest after every head', () => {
    expect(spellings(['git', '*/git'], 'push *')).toEqual([
      'Bash(git push *)',
      'Bash(*/git push *)',
    ]);
  });

  it('makes a rule for the bare program when the rest is empty', () => {
    expect(spellings(['curl'], '')).toEqual(['Bash(curl)']);
  });
});
