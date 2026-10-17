import { z } from 'zod';
import type { Turns } from '@/chat';
import type { ThreadAttention } from './attention';
import type { ChatTokens, LiveAgent, ProjectState, ThreadRef, ToWebview } from '@/shared';
import type { Store } from '@/store';
import { WORKFLOW_IDS } from '@/workflow';

export const AGENT_KINDS = ['claude', 'command'] as const;
export type AgentKind = (typeof AGENT_KINDS)[number];
export const PLATFORMS = ['claude', 'cursor', 'gemini', 'kimi', 'opencode', 'github'] as const;
export const PERMISSION_MODES = ['default', 'acceptEdits', 'plan'] as const;

// Checked when Elaia starts: a wrong setting stops it there, not on some later click.
export const SettingsSchema = z.object({
  // The ticket tool for a new project. A project that already has one keeps it.
  workflow: z.enum(WORKFLOW_IDS),
  glafkaPath: z.string().min(1),
  platform: z.enum(PLATFORMS),
  agent: z.enum(AGENT_KINDS),
  claudePath: z.string().min(1),
  agentCommand: z.string(),
  permissionMode: z.enum(PERMISSION_MODES),
  allowedTools: z.array(z.string()),
  autoAdvance: z.boolean(),
  // When a chat's agent is this % full, a fresh agent takes over with a handoff note. 0 = never.
  handoffAt: z.number().min(0).max(95).optional(),
  // ask: a card for commands outside your allow list. auto: run them, risky ones blocked.
  permissions: z.enum(['ask', 'auto']).optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

// Everything the app needs from outside. The VS Code host fills it; tests fill it with fakes.
export interface AppDeps {
  store: Store;
  settings(): Settings;
  post(message: ToWebview): void;
  // A VS Code notification for things that need you.
  notify(text: string, ref: ThreadRef): void;
  // True in the one VS Code window that keeps the threads. Other windows only show state.
  isLeader(): boolean;
  now(): string;
}

// A turn waiting for a busy chat. `text` is your line (empty for a turn Elaia starts itself);
// `prompt`, when set, is what the agent gets.
export interface QueuedTurn {
  ref: ThreadRef;
  text: string;
  prompt: string | null;
  push?: boolean;
}

export interface AppState {
  deps: AppDeps;
  projects: Map<string, ProjectState>;
  turns: Turns;
  // One refresh per project at a time; a request during a refresh runs once more after it.
  refreshing: Map<string, Promise<void>>;
  again: Set<string>;
  // Tickets with a `glafka vima` running, so a ticket never gets two at once.
  advancing: Set<string>;
  // Ticket chats whose current stop the agent already explained, by thread key.
  explainedStops: Set<string>;
  // Projects whose setup card you answered (Set up or Skip): not offered again until Elaia restarts.
  setupAnswered: Set<string>;
  // Setup cards you answered this run, by project. A project here has its setup under way.
  setupSteps: Map<string, Set<string>>;
  // Epic tickets being created or tickets being started right now, so a second refresh or
  // click does not start them twice.
  starting: Set<string>;
  // Plans Elaia started on its own (an epic approved as a whole), by ticket and plan time,
  // so a start that failed is not tried again on every refresh.
  autoStarted: Set<string>;
  // Chats waiting to be written into the repo, by thread key.
  keeping: Map<string, { timer: NodeJS.Timeout; ref: ThreadRef }>;
  // Turns asked for while a chat was busy, by thread key; they go next, in order.
  queued: Map<string, QueuedTurn[]>;
  // Turns that waited for your Trust, by project. They run once you press it; a reload drops them.
  heldForTrust: Map<string, QueuedTurn[]>;
  // Projects whose trust card you answered Not now: refresh does not show it again.
  trustDeclined: Set<string>;
  // VS Code is closing: no turn starts any more.
  disposed: boolean;
  // Agents each chat has running now, by thread key (and the timer that shows their steps).
  live: Map<string, Map<string, LiveAgent>>;
  // Tokens each running turn used so far, by thread key. Gone when the turn ends.
  liveTokens: Map<string, { ref: ThreadRef; tokens: Omit<ChatTokens, 'costUsd'> }>;
  liveTimer: NodeJS.Timeout | null;
  // Dots for the tree, by thread key; and the thread on screen, scrolled to the bottom.
  attention: Map<string, ThreadAttention>;
  viewing: string | null;
  // Lines of each thread file this window has seen (read at start or written itself), by thread
  // key. A file with more lines than this was changed by another window.
  known: Map<string, number>;
  // Threads this window's panels have opened, by thread key. A change elsewhere posts them again.
  opened: Set<string>;
  // Chats whose full agent is writing its handoff note. A new message waits for it.
  handingOver: Map<string, Promise<void>>;
  // The ask for your plan's usage: running now, whether the last one you clicked for failed, and
  // when the last one started (ms), report or not.
  limitsAsk: { running: boolean; failed: boolean; lastAt: number | null };
}
