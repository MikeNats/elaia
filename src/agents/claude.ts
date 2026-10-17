import type { AgentAdapter, AgentEvent } from './types';
import { failed } from './types';
import { eventsOf, readLine } from './claudeLine';
import { contextUsed, contextWindow, tokensSoFar } from './context';
import { blockedOnPurpose } from './deny';
import { agentsOf } from './subagents';

export interface ClaudeTurn {
  bin: string;
  // Null starts a new session. Sessions belong to one folder; they do not resume elsewhere.
  sessionId: string | null;
  permissionMode: string;
  allowedTools: string[];
  // True while a background coder owns the files.
  readOnly: boolean;
  // More tools to deny, as Claude permission rules (e.g. `Edit(.worktrees/**)`).
  denyRules?: string[];
  // Added to Claude's system prompt for this turn only. Fresh every turn, so it can be current.
  extraSystemPrompt?: string;
  // More folders Claude may use, outside the one it runs in (the spec and plan, say).
  addDirs?: string[];
  // The only built-in tools this turn has. Left out: all of them.
  tools?: string[];
  // The model you picked for this chat; "default" or none leaves it to Claude.
  model?: string;
  prompt: string;
}

// The tools that change files. Denied while a background coder owns the worktree.
export const EDIT_TOOLS = ['Edit', 'Write', 'NotebookEdit'] as const;

// Tools that need Claude Code's own window. In a chat panel they can only fail, again and again.
export const WINDOW_ONLY_TOOLS = ['AskUserQuestion'] as const;

export function claudeArgs(turn: ClaudeTurn): string[] {
  const args = ['-p', '--output-format', 'stream-json', '--verbose'];
  args.push('--permission-mode', turn.permissionMode);
  if (turn.sessionId) args.push('--resume', turn.sessionId);
  if (turn.allowedTools.length > 0) args.push('--allowedTools', turn.allowedTools.join(','));
  const denied = [
    ...WINDOW_ONLY_TOOLS,
    ...(turn.readOnly ? EDIT_TOOLS : []),
    ...(turn.denyRules ?? []),
  ];
  if (denied.length > 0) args.push('--disallowedTools', denied.join(','));
  if (turn.extraSystemPrompt) args.push('--append-system-prompt', turn.extraSystemPrompt);
  if (turn.addDirs && turn.addDirs.length > 0) args.push('--add-dir', ...turn.addDirs);
  if (turn.tools) args.push('--tools', turn.tools.join(','));
  if (turn.model && turn.model !== 'default') args.push('--model', turn.model);
  return args;
}

// Claude's usual context size, when a result line does not say.
const DEFAULT_WINDOW = 200_000;

// A tool result that is a permission refusal, not a real error.
const REFUSED = /requires approval|requested permissions|haven't granted/;

export function claudeAdapter(turn: ClaudeTurn): AgentAdapter {
  let sawResult = false;
  let used = 0;
  // Did a tool work after the last refusal? Then the agent was not stuck.
  let lastRefused = -1;
  let lastWorked = -1;
  let results = 0;
  const running = new Set<string>();
  const calls = new Map<string, Record<string, unknown>>();
  return {
    command: turn.bin,
    args: claudeArgs(turn),
    input: turn.prompt,
    parseLine(raw: string): AgentEvent[] {
      const line = readLine(raw);
      if (!line) return [];
      used = contextUsed(line) ?? used;
      const window = contextWindow(line) ?? DEFAULT_WINDOW;
      const spent = tokensSoFar(line, calls);
      const live = [...agentsOf(line, running), ...(spent ? [spent] : [])];
      const events = eventsOf(line).map((e): AgentEvent => {
        if (e.kind === 'tool-result') {
          results += 1;
          if (e.isError && REFUSED.test(e.text)) lastRefused = results;
          else if (!e.isError) lastWorked = results;
        }
        if (e.kind !== 'done') return e;
        sawResult = true;
        const denied = e.denied.filter((d) => !blockedOnPurpose(d, turn.denyRules ?? []));
        // Not stuck: a tool worked after the main agent's last refusal, or only a subagent was
        // refused (the main agent never was) and went on. No tool results at all: unknown, so ask.
        const around = results > 0 && (lastRefused < 0 || lastWorked > lastRefused);
        const done = around ? { ...e, denied: [], workedAround: denied } : { ...e, denied };
        return used > 0 ? { ...done, context: { used, window } } : done;
      });
      return [...live, ...events];
    },
    finish(exitCode, stderr) {
      return sawResult ? [] : [failed(exitCode, stderr, 'claude')];
    },
  };
}
