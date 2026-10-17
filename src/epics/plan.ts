import { createHash } from 'node:crypto';
import type { Epic } from './schema';

// What you approve: the plan itself. Progress (status, ticket ids, states) is left out,
// so Elaia's own writes keep the approval, and any change to the plan asks for it again.
export function planHash(epic: Epic): string {
  const plan = {
    title: epic.title,
    goal: epic.goal,
    brief: epic.brief,
    sources: epic.sources,
    ordered: epic.ordered,
    tickets: epic.tickets.map((t) => ({
      key: t.key,
      title: t.title,
      brief: t.brief,
      dependsOn: t.dependsOn,
    })),
  };
  return createHash('sha256').update(JSON.stringify(plan)).digest('hex');
}
