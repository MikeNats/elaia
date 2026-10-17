import type { ThreadEntry, TicketView } from '@/shared';

// One rule per thing glafka can change. Each returns the entries for that change only.
export type Rule = (old: TicketView, now: TicketView, at: string) => ThreadEntry[];

export const ACTIVE_STATES = ['running', 'stalled'] as const;
const isActive = (state: string) => (ACTIVE_STATES as readonly string[]).includes(state);

export function glafkaEntry(
  at: string,
  kind: ThreadEntry['kind'],
  text: string,
  actions?: ThreadEntry['actions'],
): ThreadEntry {
  return { at, kind, text, shown: true, source: 'glafka', ...(actions ? { actions } : {}) };
}

export const stageRule: Rule = (old, now, at) =>
  old.position === now.position
    ? []
    : [{ ...glafkaEntry(at, 'progress', `Stage: ${now.position}`), shown: false }];

// Only the start. A run's end is read from its exit-code file, so a run that ends between
// two looks is never missed (see copyRuns in the app).
export const coderRule: Rule = (old, now, at) =>
  isActive(now.coder.state) && !isActive(old.coder.state)
    ? [glafkaEntry(at, 'progress', 'Coder started')]
    : [];

export const stepsRule: Rule = (old, now, at) =>
  now.steps
    .filter((step) => !old.steps.includes(step))
    .map((step) => glafkaEntry(at, 'progress', `Commit: ${step}`));

export const checksRule: Rule = (old, now, at) =>
  old.checksOutcome !== now.checksOutcome && now.checksOutcome === 'ok'
    ? [glafkaEntry(at, 'progress', 'Checks passed.')]
    : [];

export const qaRule: Rule = (old, now, at) => {
  const seen = new Set((old.qa?.results ?? []).map((r) => `${r.id}:${r.result}:${r.evidence}`));
  return (now.qa?.results ?? [])
    .filter((r) => !seen.has(`${r.id}:${r.result}:${r.evidence}`))
    .map((r) =>
      r.result === 'pass'
        ? glafkaEntry(at, 'progress', `QA ${r.id} passed`)
        : glafkaEntry(
            at,
            'finding',
            `QA ${r.id} ${r.result === 'fail' ? 'failed' : 'could not be checked'} — ${r.evidence}`,
          ),
    );
};
