import { describe, expect, it } from 'vitest';
import { isSafeName, isThreadName, ToHostSchema } from '@/shared';

describe('safe names', () => {
  it.each(['project', 'publish-polish', '2026-10-17-safety-checks-where-data-comes-in', 'v1.2'])(
    'accepts %s',
    (name) => expect(isSafeName(name)).toBe(true),
  );
  it.each(['', '--force', '-x', '../../y', 'a/b', '..', 'a..b', 'a b', 'x'.repeat(201)])(
    'refuses %j',
    (name) => expect(isSafeName(name)).toBe(false),
  );
});

describe('thread names', () => {
  it.each([
    'project',
    'epic-publish-polish',
    '2026-10-17-safety-checks-where-data-comes-in',
    'todo-publish-polish~chat-queue',
  ])('accepts %s', (thread) => expect(isThreadName(thread)).toBe(true));
  it.each(['epic-../../y', '--force', 'todo-a~b~c', 'todo-a~../x', 'todo-~b', 'a/b'])(
    'refuses %j',
    (thread) => expect(isThreadName(thread)).toBe(false),
  );
});

describe('ToHostSchema names', () => {
  const project = '/p';
  const ok = (msg: unknown) => ToHostSchema.safeParse(msg).success;

  it.each(['advance', 'push', 'merge', 'close-ticket', 'cancel-ticket', 'open-diff'] as const)(
    '%s refuses ticket --force',
    (type) => expect(ok({ type, project, ticket: '--force' })).toBe(false),
  );

  it('refuses an unsafe epic, start-ticket id or thread', () => {
    expect(ok({ type: 'approve-epic', project, epic: '../../y', approval: 'epic' })).toBe(false);
    expect(ok({ type: 'start-ticket', project, thread: 'project', ticket: '-x' })).toBe(false);
    expect(ok({ type: 'send', project, thread: 'epic-../../y', text: 'hi' })).toBe(false);
  });

  it('accepts the names Elaia makes', () => {
    const id = '2026-10-17-safety-checks-where-data-comes-in';
    expect(ok({ type: 'advance', project, ticket: id })).toBe(true);
    expect(ok({ type: 'approve-epic', project, epic: 'publish-polish', approval: 'epic' })).toBe(
      true,
    );
    expect(ok({ type: 'open-thread', project, thread: 'todo-publish-polish~chat-queue' })).toBe(
      true,
    );
  });
});
