import { z } from 'zod';
import type { ChatTokens, TicketView, TokenRow } from './glafka';
import type { ProviderLimits } from './limits';
import type { LiveAgent } from './live';
import { isSafeName, isThreadName, type ThreadEntry, type ThreadRef } from './thread';

// Webview → host. Requests are strict: an unknown field is a bug, not a no-op.
// Names become paths and glafka arguments: only safe ones get through.
const name = z.string().refine(isSafeName, 'not a safe name');
const ref = { project: z.string(), thread: z.string().refine(isThreadName, 'not a thread name') };

export const ToHostSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ready') }),
  z.strictObject({ type: z.literal('add-project') }),
  z.strictObject({ type: z.literal('remove-project'), project: z.string() }),
  z.strictObject({ type: z.literal('open-thread'), ...ref }),
  // Switch the panel to another thread (a button that says "Open epic chat").
  z.strictObject({ type: z.literal('show-thread'), ...ref }),
  z.strictObject({ type: z.literal('set-permissions'), mode: z.enum(['ask', 'auto']) }),
  z.strictObject({ type: z.literal('set-model'), ...ref, model: z.string().min(1) }),
  // The refresh button on the usage bar: ask for your plan's usage now.
  z.strictObject({ type: z.literal('refresh-usage') }),
  // This thread is on screen; atBottom = you have scrolled to its last message.
  z.strictObject({ type: z.literal('viewing'), ...ref, atBottom: z.boolean() }),
  z.strictObject({ type: z.literal('send'), ...ref, text: z.string().min(1) }),
  z.strictObject({ type: z.literal('stop'), ...ref }),
  z.strictObject({ type: z.literal('clear-chat'), ...ref }),
  z.strictObject({ type: z.literal('allow'), ...ref, tool: z.string().min(1) }),
  z.strictObject({ type: z.literal('advance'), project: z.string(), ticket: name }),
  z.strictObject({ type: z.literal('push'), project: z.string(), ticket: name }),
  z.strictObject({ type: z.literal('merge'), project: z.string(), ticket: name }),
  z.strictObject({ type: z.literal('close-ticket'), project: z.string(), ticket: name }),
  z.strictObject({ type: z.literal('cancel-ticket'), project: z.string(), ticket: name }),
  // `thread` is the chat the Start card is in: Elaia answers there.
  z.strictObject({ type: z.literal('start-ticket'), ...ref, ticket: name }),
  z.strictObject({ type: z.literal('setup'), project: z.string() }),
  z.strictObject({ type: z.literal('skip-setup'), project: z.string() }),
  z.strictObject({ type: z.literal('trust'), project: z.string(), hash: z.string() }),
  z.strictObject({ type: z.literal('not-trust'), project: z.string() }),
  z.strictObject({
    type: z.literal('setup-step'),
    project: z.string(),
    step: z.string().min(1),
    choice: z.string().min(1),
  }),
  z.strictObject({
    type: z.literal('approve-epic'),
    project: z.string(),
    epic: name,
    approval: z.enum(['epic', 'ticket']),
  }),
  z.strictObject({
    type: z.literal('drop-files'),
    project: z.string(),
    files: z.array(z.strictObject({ name: z.string().min(1), data: z.string() })).max(20),
  }),
  // Move the Elaia tab into its own window (with its own tree), or back to the main window.
  z.strictObject({ type: z.literal('own-window'), on: z.boolean() }),
  // Open a ticket's worktree in a new window. The host looks the folder up: no path comes in.
  z.strictObject({ type: z.literal('open-folder'), project: z.string(), ticket: name }),
  z.strictObject({ type: z.literal('open-diff'), project: z.string(), ticket: name }),
]);
export type ToHost = z.infer<typeof ToHostSchema>;
export type ToHostType = ToHost['type'];

// An epic and how far each of its tickets is, for the tree.
export interface EpicView {
  slug: string;
  title: string;
  status: string;
  tickets: { key: string; title: string; ticketId: string | null; state: string }[];
}

export interface ProjectState {
  path: string;
  name: string;
  tickets: TicketView[];
  // Token use of glafka's own runs, one row per ticket.
  tokens: TokenRow[];
  // Token use of Elaia's chat turns, by thread name.
  chatTokens: Record<string, ChatTokens>;
  epics: EpicView[];
  error: string | null;
}

// A dot in the tree: a question waits for your answer, or there is something new.
export type Attention = 'waiting' | 'new';

export interface Snapshot {
  projects: ProjectState[];
  // By thread key. Threads with nothing to say are left out.
  attention?: Record<string, Attention>;
  // How chats treat commands outside your allow list.
  permissions?: 'ask' | 'auto';
  // The models a chat can pick (from the agent in use), and the one picked per thread key.
  models?: { id: string; label: string }[];
  chosenModels?: Record<string, string>;
  // Your plan's limits, as each provider last reported them; what Elaia itself spent in the
  // last 5 hours and 7 days (dollars at API prices); whether an ask for new numbers is running
  // now (timer or button); and whether the last ask you made with the button failed.
  usage?: {
    limits: ProviderLimits[];
    spent: { session: number; week: number };
    refreshing: boolean;
    failed: boolean;
  };
  // Messages waiting for a busy chat, by thread key.
  queued?: Record<string, number>;
  // Agents each chat has running now, by thread key: what each was asked, and its latest step.
  agents?: Record<string, LiveAgent[]>;
  // Who answers in the chats: "Claude", or "Agent" for any other CLI.
  agentName: string;
  // Thread keys with a chat turn running.
  busy: string[];
}

export interface SearchHit {
  project: string;
  path: string;
  title: string;
  snippet: string;
}

// Host → webview.
export type ToWebview =
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'thread'; ref: ThreadRef; entries: ThreadEntry[] }
  | { type: 'entries'; ref: ThreadRef; entries: ThreadEntry[] }
  // Open this thread now, e.g. the ticket you just created.
  | { type: 'focus'; ref: ThreadRef }
  // The Elaia tab is in its own window: it shows its own tree (the sidebar cannot come along).
  | { type: 'own-window'; on: boolean }
  | { type: 'error'; text: string };
