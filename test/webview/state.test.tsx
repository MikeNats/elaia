import { describe, expect, it } from 'vitest';
import { initialState, reduce } from '@/webview/state';
import type { ThreadEntry } from '@/shared';

const ref = { project: '/p', thread: 't1' };
const entry = (text: string): ThreadEntry => ({
  at: 'x',
  kind: 'agent',
  text,
  shown: true,
  source: 'chat',
});

describe('webview state', () => {
  it('loads a thread, then appends live entries to it', () => {
    let s = reduce(initialState, { type: 'thread', ref, entries: [entry('a')] });
    s = reduce(s, { type: 'entries', ref, entries: [entry('b')] });
    expect(s.threads['/p::t1']?.map((e) => e.text)).toEqual(['a', 'b']);
  });

  it('ignores live entries for a thread it has not loaded', () => {
    const s = reduce(initialState, { type: 'entries', ref, entries: [entry('b')] });
    expect(s.threads['/p::t1']).toBeUndefined();
  });

  it('selects a thread on focus', () => {
    expect(reduce(initialState, { type: 'focus', ref }).selected).toEqual(ref);
  });

  it('keeps errors until dismissed', () => {
    const s = reduce(initialState, { type: 'error', text: 'boom' });
    expect(s).toMatchObject({ error: 'boom' });
    expect(reduce(s, { type: 'dismiss-error' }).error).toBeNull();
  });
});
