import { describe, expect, it } from 'vitest';
import { EpicSchema, readyToStart, waitingOnCancelled, type Epic } from '@/epics';

const epic = (tickets: object[], ordered = false): Epic =>
  EpicSchema.parse({ title: 'Epic', status: 'approved', ordered, tickets });
const t = (key: string, more: object = {}) => ({ key, title: `Fix ${key}`, brief: key, ...more });
// [cancelled key, keys waiting on it] per line the epic chat would get.
const keysOf = (found: ReturnType<typeof waitingOnCancelled>) =>
  found.map(({ cancelled, waiting }) => [cancelled.key, waiting.map((w) => w.key)]);

describe('waitingOnCancelled', () => {
  it('names a ticket whose dependency was cancelled, and that ticket still does not start', () => {
    const e = epic([t('a', { state: 'cancelled', ticketId: 'x' }), t('b', { dependsOn: ['a'] })]);
    expect(keysOf(waitingOnCancelled(e))).toEqual([['a', ['b']]]);
    expect(readyToStart(e)).toEqual([]);
  });

  it('names only the tickets that wait on it directly', () => {
    const e = epic([
      t('a', { state: 'cancelled', ticketId: 'x' }),
      t('b', { dependsOn: ['a'] }),
      t('c', { dependsOn: ['b'] }),
    ]);
    expect(keysOf(waitingOnCancelled(e))).toEqual([['a', ['b']]]);
  });

  it('in an ordered epic, names every waiting ticket after the cancelled one', () => {
    const e = epic(
      [
        t('a', { state: 'merged', ticketId: 'x' }),
        t('b', { state: 'cancelled', ticketId: 'y' }),
        t('c'),
        t('d'),
        t('e'),
      ],
      true,
    );
    expect(keysOf(waitingOnCancelled(e))).toEqual([['b', ['c', 'd', 'e']]]);
  });

  it('says nothing when no ticket waits on the cancelled one', () => {
    const e = epic([t('a', { state: 'cancelled', ticketId: 'x' }), t('b')]);
    expect(waitingOnCancelled(e)).toEqual([]);
  });
});
