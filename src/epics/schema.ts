import { z } from 'zod';

export const EPIC_STATUSES = ['proposed', 'approved', 'done'] as const;
export const APPROVALS = ['epic', 'ticket'] as const;
export const TICKET_STATES = ['waiting', 'started', 'merged', 'cancelled'] as const;
export type Approval = (typeof APPROVALS)[number];

// The epic chat sometimes calls the key "id" (seen 2026-10-15): read it as the key.
const idAsKey = (raw: unknown) =>
  raw && typeof raw === 'object' && !('key' in raw) && 'id' in raw
    ? { ...raw, key: (raw as { id: unknown }).id }
    : raw;

// One ticket of an epic. The planner writes what and why; Elaia writes how far it is.
export const EpicTicketSchema = z.preprocess(
  idAsKey,
  z.object({
    key: z.string().min(1),
    title: z.string().min(1),
    brief: z.string().min(1),
    dependsOn: z.array(z.string()).default([]),
    ticketId: z.string().nullable().default(null),
    state: z.enum(TICKET_STATES).default('waiting'),
  }),
);
export type EpicTicket = z.infer<typeof EpicTicketSchema>;

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
  });
export type Epic = z.infer<typeof EpicSchema>;
