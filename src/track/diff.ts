import type { ThreadEntry, TicketView } from '@/shared';
import { checksRule, coderRule, glafkaEntry, qaRule, stageRule, stepsRule } from './workRules';
import { closeRule, prRule, pushedRule, reviewRule, summaryRule } from './resultRules';

// In the order things happen: the work, its checks and review, then what you do next.
const RULES = [
  stageRule,
  coderRule,
  stepsRule,
  checksRule,
  qaRule,
  reviewRule,
  prRule,
  pushedRule,
  summaryRule,
  closeRule,
];

// What changed in one ticket since we last looked, as thread entries. The first time a ticket
// is seen, it is also checked for "needs you" or "ready", so a blocked ticket is never silent.
export function diffTicket(
  old: TicketView | undefined,
  now: TicketView,
  at: string,
): ThreadEntry[] {
  if (old) return RULES.flatMap((rule) => rule(old, now, at));
  const unseen = { ...now, summary: { rank: now.summary.rank, text: '' } };
  return [
    glafkaEntry(at, 'progress', `Ticket found — ${now.position}`),
    ...summaryRule(unseen, now, at),
  ];
}
