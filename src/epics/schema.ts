import { z } from 'zod';
import { isSafeName } from '@/shared';

export const EPIC_STATUSES = ['proposed', 'approved', 'done'] as const;
export const APPROVALS = ['epic', 'ticket'] as const;
export const TICKET_STATES = ['waiting', 'started', 'merged', 'cancelled'] as const;
export type Approval = (typeof APPROVALS)[number];

// The epic chat sometimes calls the key "id" (seen 2026-10-15): read it as the key.
const idAsKey = (raw: unknown) =>
  raw && typeof raw === 'object' && !('key' in raw) && 'id' in raw
    ? { ...raw, key: (raw as { id: unknown }).id }
    : raw;

// A key becomes part of a thread name ('todo-<slug>~<key>'), which the webview checks the same way.
const KEY_RULE = 'must be short kebab-case (letters, digits, - . _), like "csv-export"';
const key = z.string().refine(isSafeName, KEY_RULE);

// One ticket of an epic. The planner writes what and why; Elaia writes how far it is.
export const EpicTicketSchema = z.preprocess(
  idAsKey,
  z.object({
    key,
    title: z.string().min(1),
    brief: z.string().min(1),
    dependsOn: z.array(key).default([]),
    ticketId: z.string().nullable().default(null),
    state: z.enum(TICKET_STATES).default('waiting'),
  }),
);
export type EpicTicket = z.infer<typeof EpicTicketSchema>;

// The first dependsOn loop, as keys from the repeated one back to itself. A self-dependency
// and an unknown key have their own messages, so they are left out here.
function findLoop(tickets: { key: string; dependsOn: string[] }[]): string[] | null {
  const deps = new Map(tickets.map((t) => [t.key, t.dependsOn.filter((d) => d !== t.key)]));
  const done = new Set<string>();
  const path: string[] = [];
  const visit = (key: string): string[] | null => {
    if (done.has(key)) return null;
    const at = path.indexOf(key);
    if (at >= 0) return [...path.slice(at), key];
    path.push(key);
    for (const dep of deps.get(key) ?? []) {
      if (!deps.has(dep)) continue;
      const loop = visit(dep);
      if (loop) return loop;
    }
    path.pop();
    done.add(key);
    return null;
  };
  for (const t of tickets) {
    const loop = visit(t.key);
    if (loop) return loop;
  }
  return null;
}

export const EpicSchema = z
  .object({
    title: z.string().min(1),
    goal: z.string().default(''),
    // What the epic's own chat must find out and do to cut the tickets (the main chat writes it).
    brief: z.string().default(''),
    sources: z.array(z.string()).default([]),
    // True when you gave an order: then tickets run strictly one after another.
    ordered: z.boolean().default(false),
    status: z.enum(EPIC_STATUSES).default('proposed'),
    approval: z.enum(APPROVALS).nullable().default(null),
    // Empty while the epic's chat is still working out the tickets.
    tickets: z.array(EpicTicketSchema).default([]),
  })
  .superRefine((epic, ctx) => {
    const keys = new Set(epic.tickets.map((t) => t.key));
    for (const t of epic.tickets) {
      for (const dep of t.dependsOn) {
        if (!keys.has(dep))
          ctx.addIssue({
            code: 'custom',
            message: `ticket "${t.key}" depends on unknown "${dep}"`,
          });
      }
    }
    if (keys.size !== epic.tickets.length)
      ctx.addIssue({ code: 'custom', message: 'two tickets share a key' });
    // Nothing in a loop ever starts: each ticket waits for another one in it.
    for (const t of epic.tickets)
      if (t.dependsOn.includes(t.key))
        ctx.addIssue({ code: 'custom', message: `ticket "${t.key}" depends on itself` });
    // In an ordered epic, a later ticket already waits for every earlier one.
    if (epic.ordered) {
      const place = new Map(epic.tickets.map((t, i) => [t.key, i]));
      epic.tickets.forEach((t, i) => {
        for (const dep of t.dependsOn)
          if ((place.get(dep) ?? -1) > i)
            ctx.addIssue({
              code: 'custom',
              message: `ticket "${t.key}" depends on "${dep}", which comes after it in an ordered epic`,
            });
      });
    }
    const loop = findLoop(epic.tickets);
    if (loop)
      ctx.addIssue({
        code: 'custom',
        message: `tickets depend on each other in a loop: ${loop.map((k) => `"${k}"`).join(' → ')}`,
      });
  });
export type Epic = z.infer<typeof EpicSchema>;
