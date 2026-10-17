import { describe, expect, it } from 'vitest';
import { diffTicket } from '@/track';
import { makeTicket } from '../../support/ticket';

const at = '2026-10-13T10:00:00Z';
const texts = (entries: { text: string }[]) => entries.map((e) => e.text);

describe('diffTicket', () => {
  it('says a ticket was found the first time it is seen', () => {
    expect(texts(diffTicket(undefined, makeTicket(), at))).toEqual(['Ticket found — planned']);
  });

  it('reports nothing when nothing changed', () => {
    expect(diffTicket(makeTicket(), makeTicket(), at)).toEqual([]);
  });

  it('keeps a stage change in the details (the plain step lines say what happens)', () => {
    const entries = diffTicket(makeTicket(), makeTicket({ position: 'coded' }), at);
    expect(entries).toEqual([
      { at, kind: 'progress', text: 'Stage: coded', shown: false, source: 'glafka' },
    ]);
  });

  it('reports the coder starting; its end comes from the run files', () => {
    const running = makeTicket({ coder: { state: 'running' } });
    expect(texts(diffTicket(makeTicket(), running, at))).toEqual(['Coder started']);
    expect(diffTicket(running, makeTicket({ coder: { state: 'finished' } }), at)).toEqual([]);
  });

  it('says needs-you or ready the first time a ticket is seen', () => {
    const ready = makeTicket({ summary: { rank: 0, text: 'x  ✔ ready for you  — clean' } });
    expect(texts(diffTicket(undefined, ready, at))).toEqual([
      'Ticket found — planned',
      'Ready to push',
    ]);
  });

  it('reports each new commit', () => {
    const before = makeTicket({ steps: ['task 1'] });
    const after = makeTicket({ steps: ['task 1', 'task 2'] });
    expect(texts(diffTicket(before, after, at))).toEqual(['Commit: task 2']);
  });

  it('reports QA results per criterion', () => {
    const qa = (result: string) => ({
      outcome: null,
      results: [{ id: 'AC-1', result, evidence: 'curl → 500', verified: true }],
    });
    const failed = diffTicket(makeTicket(), makeTicket({ qa: qa('fail') }), at);
    expect(failed[0]).toMatchObject({ kind: 'finding', text: 'QA AC-1 failed — curl → 500' });
    const passed = diffTicket(makeTicket({ qa: qa('fail') }), makeTicket({ qa: qa('pass') }), at);
    expect(passed[0]).toMatchObject({ kind: 'progress', text: 'QA AC-1 passed' });
  });

  it('reports new blocking review findings and a clean verdict', () => {
    const review = (findings: { verdict: string; finding: string }[], verdict: string | null) => ({
      status: { state: 'finished' },
      findings,
      verdict: { source: 'krisis', verdict, finding: null },
    });
    const blocking = makeTicket({
      review: review([{ verdict: 'blocking', finding: 'a.ts:3 — bug' }], 'blocking'),
    });
    expect(texts(diffTicket(makeTicket(), blocking, at))).toContain('Review: a.ts:3 — bug');
    const clean = makeTicket({ review: review([], 'clean') });
    expect(texts(diffTicket(blocking, clean, at))).toContain('Review clean');
  });

  it('asks you to push when glafka says ready', () => {
    const ready = makeTicket({ summary: { rank: 0, text: 'x  ✔ ready for you  — clean' } });
    const [entry] = diffTicket(makeTicket(), ready, at);
    expect(entry).toMatchObject({ kind: 'approval', text: 'Ready to push' });
    expect(entry?.actions).toEqual([
      { kind: 'push', label: 'Push it', value: '2026-10-13-add-csv-export' },
    ]);
  });

  it('flags needs-you with the reason', () => {
    const stuck = makeTicket({ summary: { rank: 0, text: 'x  ⚠ needs you  — checks failed' } });
    expect(diffTicket(makeTicket(), stuck, at)[0]).toMatchObject({
      kind: 'needs-you',
      text: 'Needs you: checks failed',
    });
  });

  it('reports a PR and the close', () => {
    const pr = makeTicket({ prUrl: 'https://github.com/x/y/pull/1', pushed: true });
    expect(texts(diffTicket(makeTicket(), pr, at))).toEqual([
      'PR opened: https://github.com/x/y/pull/1',
    ]);
    expect(texts(diffTicket(pr, { ...pr, closed: true }, at))).toEqual(['Ticket closed']);
  });
});
