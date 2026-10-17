import type { TicketView, TokenRow } from '@/shared';

export interface SetupItem {
  key: string;
  label: string;
  done: boolean;
  optional: boolean;
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

// A setup step the tool does itself, with no agent. `label` is said before, `done` after.
export interface SetupRun {
  label: string;
  done: string;
  run(): Promise<CommandResult>;
}

// Something setup found for you to keep or change, shown as one card.
export interface SetupFinding {
  key: string;
  title: string;
  items: string[];
  // The Keep button's label.
  keep: string;
}

export interface FinishedRun {
  role: string;
  startedAt: string;
  log: string;
  exitCode: number | null;
}

// What a ticket's own chat is told to plan: the ask, and its epic when it has one.
export interface TicketBrief {
  id: string;
  title: string;
  brief: string;
  epic: { title: string; file: string; sources: string[] } | null;
}

// close and push are Elaia's own buttons; run asks the agent for exactly this one command.
export type TypedStep = { kind: 'close' } | { kind: 'push' } | { kind: 'run'; prompt: string };

// Which ticket a ticket chat belongs to, and where its worktree is.
export interface TicketPlace {
  id: string;
  title: string;
  worktree: string | null;
  branch: string | null;
}

export interface NextStep {
  id: string;
  action: string;
  reason?: string;
}

// What Elaia needs from a ticket tool. glafka is the default; another tool
// plugs in by answering the same questions. Elaia's core never names a tool.
export interface Workflow {
  id: string;
  name: string;
  // Where it lives in a project.
  isInstalled(project: string): boolean;
  stateDir(project: string): string;
  isTicketChange(relativePath: string): boolean;
  worktreesDir: string;
  // Commands its skills run, so a chat may run them without asking.
  allowedTools: string[];
  // Commands the main chat and epic chats may never run: a worktree and a coder start only
  // from Elaia's Start button.
  plannerDenied: string[];
  // Commands that make a ticket. Epic chats and ticket chats may not: Elaia makes an epic's
  // tickets, and a ticket chat keeps to its own ticket.
  createDenied: string[];
  // A ticket chat may run no step of these other tickets.
  otherTicketsDenied(ids: string[]): string[];
  // Commands only the Push button may run: they push and open a PR.
  pushOnly: string[];
  // Files no chat may edit, relative to the project: changing them could make the tool run anything.
  lockedFiles: string[];
  // Also locked in ticket and epic chats. The main chat keeps them: setup there writes them.
  lockedOutsideMain: string[];
  docsDir(project: string): string;
  baseRef(project: string): string;
  agentCommand(project: string, setting: string): string | null;
  // Setting a project up.
  setupStatus(project: string): SetupItem[];
  install(project: string, platform: string): Promise<CommandResult>;
  // What the tool does with no agent, for the steps still missing.
  autoSetup(project: string, missing: string[]): SetupRun[];
  setupFindings(project: string): Promise<SetupFinding[]>;
  keepFinding(project: string, key: string): Promise<CommandResult>;
  // Change: what the main chat is asked instead.
  changeFinding(project: string, key: string): Promise<string>;
  // Files setup wrote that git does not have yet: tickets only see committed files.
  setupFiles(project: string): string[];
  setupPrompt(missing: string[]): string;
  // Tickets.
  tickets(project: string): Promise<TicketView[]>;
  ticket(project: string, id: string): Promise<TicketView | null>;
  tokens(project: string): Promise<TokenRow[]>;
  create(project: string, idea: string): Promise<string>;
  advance(project: string, id: string): Promise<NextStep[]>;
  // Where the planning chat writes a ticket's plan, relative to the project.
  planFile(id: string): string;
  // A planned ticket gets its worktree (glafka: plan), then its coder (glafka: ergon --background).
  startWork(project: string, id: string): Promise<CommandResult>;
  startCoder(project: string, id: string): Promise<CommandResult>;
  // Close a ticket: its worktree goes; the tool may refuse and say why.
  close(project: string, id: string): Promise<CommandResult>;
  // Drop a ticket without its work (glafka: cancel).
  cancel(project: string, id: string): Promise<CommandResult>;
  finishedRuns(project: string, id: string): FinishedRun[];
  lastWords(log: string): string | null;
  // What the chat is asked to run.
  // Why tickets cannot run on their own here yet, in words for you; null when they can.
  cannotRunAlone(project: string): string | null;
  // The main chat: how to tell one ticket from an epic. It plans neither itself.
  newTicketRules: string;
  // A ticket's own chat plans it with you: questions, spec, plan. Then a Start button.
  ticketGenesisPrompt(ticket: TicketBrief): string;
  // A ticket chat: which ticket and worktree it belongs to, and that it keeps to them.
  ticketRules(ticket: TicketPlace): string;
  // A step typed alone in a ticket chat ("lysis"): what it does for this ticket, or null.
  typedStep(id: string, text: string): TypedStep | null;
  pushPrompt(id: string): string;
}
