import { describe, expect, it } from 'vitest';
import { EpicSchema } from '@/epics';

const ticket = (key: string, dependsOn: string[] = []) => ({
  key,
  title: key,
  brief: key,
  dependsOn,
});

// What the schema says is wrong with an epic, or [] when it is valid.
const problems = (epic: object) => {
  const parsed = EpicSchema.safeParse({ title: 'Epic', ...epic });
  return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
};

describe('epic schema', () => {
  it('accepts tickets that depend on earlier ones', () => {
    expect(problems({ tickets: [ticket('a'), ticket('b', ['a'])] })).toEqual([]);
    expect(problems({ ordered: true, tickets: [ticket('a'), ticket('b', ['a'])] })).toEqual([]);
  });

  it('rejects a ticket that depends on itself', () => {
    expect(problems({ tickets: [ticket('a', ['a'])] })).toEqual(['ticket "a" depends on itself']);
  });

  it('rejects a dependsOn loop and names its keys', () => {
    const tickets = [ticket('a', ['b']), ticket('b', ['c']), ticket('c', ['a'])];
    expect(problems({ tickets })).toEqual([
      'tickets depend on each other in a loop: "a" → "b" → "c" → "a"',
    ]);
  });

  it('rejects a ticket in an ordered epic that depends on a later one', () => {
    expect(problems({ ordered: true, tickets: [ticket('a', ['b']), ticket('b')] })).toEqual([
      'ticket "a" depends on "b", which comes after it in an ordered epic',
    ]);
  });
});
