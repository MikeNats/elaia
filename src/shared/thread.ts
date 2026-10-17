import { z } from 'zod';

// Every kind of line a thread can hold. A closed list, so a switch can be exhaustive.
export const ENTRY_KINDS = [
  'you',
  'agent',
  'question',
  'approval',
  'progress',
  'finding',
  'needs-you',
  'tool',
  'tool-result',
  'error',
  // What the ticket is, at the top of its chat. Made when the chat opens; never kept.
  'intro',
  // Your Clear: the next agent starts fresh and sees nothing above this line.
  'cleared',
] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];

// What a button on an entry does. `value` is the message, tool or ticket it acts on.
export const ACTION_KINDS = [
  'reply',
  'allow',
  'advance',
  'push',
  'setup',
  'skip-setup',
  // A button on a setup card: `value` is "<step>:<choice>".
  'setup-step',
  'approve-epic',
  'approve-tickets',
  'open',
  'merge',
  'close',
  'cancel',
  // Start the coder on a planned ticket: its worktree, its coder, its own chat.
  'start',
] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];

export const SOURCES = ['chat', 'glafka'] as const;

export const EntryActionSchema = z.object({
  kind: z.enum(ACTION_KINDS),
  label: z.string(),
  value: z.string(),
  // The thread it acts on, when not the one it is shown in (a ticket's card in its epic chat).
  thread: z.string().optional(),
});
export type EntryAction = z.infer<typeof EntryActionSchema>;

export const ThreadEntrySchema = z.object({
  at: z.string(),
  kind: z.enum(ENTRY_KINDS),
  text: z.string(),
  // Hidden entries sit behind "show details".
  shown: z.boolean(),
  source: z.enum(SOURCES),
  actions: z.array(EntryActionSchema).optional(),
});
export type ThreadEntry = z.infer<typeof ThreadEntrySchema>;

// The project chat uses this name; every other thread is named by its ticket id.
export const PROJECT_THREAD = 'project';

// Each epic has its own chat, named after the epic's folder. Ticket ids start with a date.
const EPIC_PREFIX = 'epic-';
export const epicThread = (slug: string) => `${EPIC_PREFIX}${slug}`;
export const epicSlugOf = (thread: string): string | null =>
  thread.startsWith(EPIC_PREFIX) ? thread.slice(EPIC_PREFIX.length) : null;

// An epic's ticket that has no ticket in the tool yet: a page with its plan, no chat.
const TODO_PREFIX = 'todo-';
export const todoThread = (slug: string, key: string) => `${TODO_PREFIX}${slug}~${key}`;
export function todoOf(thread: string): { slug: string; key: string } | null {
  if (!thread.startsWith(TODO_PREFIX)) return null;
  const [slug, key] = thread.slice(TODO_PREFIX.length).split('~');
  return slug && key ? { slug, key } : null;
}

export interface ThreadRef {
  project: string;
  thread: string;
}

export function threadKey(ref: ThreadRef): string {
  return `${ref.project}::${ref.thread}`;
}

export function sameRef(a: ThreadRef | null, b: ThreadRef | null): boolean {
  return a !== null && b !== null && a.project === b.project && a.thread === b.thread;
}
