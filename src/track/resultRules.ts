import type { Rule } from './workRules';
import { glafkaEntry } from './workRules';

const NEEDS_YOU = 'needs you';
const READY = 'ready for you';

export const reviewRule: Rule = (old, now, at) => {
  const seen = new Set(old.review.findings.map((f) => f.finding ?? ''));
  const blocking = now.review.findings
    .filter((f) => f.verdict === 'blocking' && f.finding && !seen.has(f.finding))
    .map((f) => glafkaEntry(at, 'finding', `Review: ${f.finding}`));
  const wasClean = old.review.verdict.verdict === 'clean';
  const isClean = now.review.verdict.verdict === 'clean' && now.review.verdict.source === 'krisis';
  return isClean && !wasClean
    ? [...blocking, glafkaEntry(at, 'progress', 'Review clean')]
    : blocking;
};

// glafka's own one-line summary decides "needs you" and "ready", so Elaia never guesses.
export const summaryRule: Rule = (old, now, at) => {
  if (now.summary.rank !== 0 || old.summary.text === now.summary.text) return [];
  const text = now.summary.text;
  if (text.includes(READY)) {
    return [
      glafkaEntry(at, 'approval', 'Ready to push', [
        { kind: 'push', label: 'Push it', value: now.id },
      ]),
    ];
  }
  if (text.includes(NEEDS_YOU)) {
    const reason = text.split('—').slice(1).join('—').trim() || text;
    return [glafkaEntry(at, 'needs-you', `Needs you: ${reason}`)];
  }
  return [];
};

export const prRule: Rule = (old, now, at) =>
  !old.prUrl && now.prUrl ? [glafkaEntry(at, 'progress', `PR opened: ${now.prUrl}`)] : [];

// Pushed: what is left is merging and closing. glafka never merges, so the card offers it
// (no GitHub) or says where to merge (a pull request), and Close ticket runs glafka's close.
export const pushedRule: Rule = (old, now, at) => {
  if (old.position.startsWith('pushed') || !now.position.startsWith('pushed')) return [];
  const close = { kind: 'close' as const, label: 'Close ticket', value: now.id };
  if (now.prUrl)
    return [
      glafkaEntry(
        at,
        'approval',
        'Pushed, and the pull request is open. Merge it on GitHub, then close the ticket.',
        [close],
      ),
    ];
  const merge = { kind: 'merge' as const, label: 'Merge it', value: now.id };
  return [
    glafkaEntry(
      at,
      'approval',
      'Pushed. Next: merge it into the base branch, then close the ticket.',
      [merge, close],
    ),
  ];
};

export const closeRule: Rule = (old, now, at) =>
  !old.closed && now.closed
    ? [glafkaEntry(at, 'progress', now.cancelled ? 'Ticket cancelled' : 'Ticket closed')]
    : [];
