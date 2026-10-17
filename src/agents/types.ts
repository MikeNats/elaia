import type { ChatTokens, LimitWindow } from '@/shared';

// A tool the agent asked for and was not allowed. `allow` is the rule that would permit it.
export interface Denial {
  tool: string;
  summary: string;
  // What the agent wanted, in plain words, for the person deciding.
  wants: string;
  // The whole command or path, not cut short: what deny rules are checked against.
  target?: string;
  allow: string;
}

export type AgentEvent =
  | { kind: 'session'; sessionId: string }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; summary: string }
  | { kind: 'tool-result'; isError: boolean; text: string }
  | {
      kind: 'done';
      sessionId: string | null;
      isError: boolean;
      tokens: ChatTokens | null;
      denied: Denial[];
      error: string | null;
      // How full the context was at the end, in tokens. Claude only.
      context?: { used: number; window: number };
      // Refused, but the agent went on and found another way: shown in the details only.
      workedAround?: Denial[];
    }
  // The turn's tokens so far, before it ends and reports the real total.
  | { kind: 'tokens'; tokens: Omit<ChatTokens, 'costUsd'> }
  // The agent squeezed its own context to go on (Claude's auto-compact).
  | { kind: 'compacted' }
  // The provider said how much of your plan's limits is used (Claude: rate_limit_event).
  | { kind: 'limits'; provider: string; windows: LimitWindow[] }
  // Agents the chat started, live: one began, did a step, ended.
  | { kind: 'agent-start'; id: string; about: string; task?: string }
  | { kind: 'agent-step'; id: string; doing: string }
  | { kind: 'agent-end'; id: string };

// How to start one agent turn, and how to read what it prints.
export interface AgentAdapter {
  command: string;
  args: string[];
  // Sent on stdin. Never an argument: some flags take a list and would swallow it.
  input: string;
  parseLine(line: string): AgentEvent[];
  finish(exitCode: number | null, stderr: string): AgentEvent[];
}

export function failed(exitCode: number | null, stderr: string, who: string): AgentEvent {
  const tail = stderr.trim().slice(-500);
  const error = `${who} exited with code ${exitCode ?? 'none'}${tail ? `: ${tail}` : ''}`;
  return { kind: 'done', sessionId: null, isError: true, tokens: null, denied: [], error };
}
