import { existsSync } from 'node:fs';
import { claudeAdapter, commandAdapter, type AgentAdapter, type AgentEvent } from '@/agents';
import { memoryEnv } from '@/memory';
import type { ThreadEntry, ThreadRef } from '@/shared';
import type { Store } from '@/store';
import type { AgentChoice } from './choice';
import { eventHandler } from './events';
import { startProcess } from './process';

export interface ChatDeps {
  store: Store;
  now(): string;
  emit(ref: ThreadRef, entries: ThreadEntry[]): void;
  // Agents the chat started began, did a step, or ended.
  agents?(ref: ThreadRef, event: AgentEvent): void;
}

export interface TurnRequest {
  ref: ThreadRef;
  folder: string;
  // What you typed, shown in the thread. Empty for a turn Elaia starts itself.
  text: string;
  // What the agent receives: your text, maybe with context in front.
  prompt: string;
  agent: AgentChoice;
}

export interface TurnResult {
  // The saved session was gone. It is dropped; the caller may retry with context.
  resumeFailed: boolean;
  // How full the agent's context was at the end. Null when the agent does not say.
  context: { used: number; window: number } | null;
}

export interface Turn {
  done: Promise<TurnResult>;
  stop(): void;
}

function adapterFor(deps: ChatDeps, req: TurnRequest) {
  if (req.agent.kind === 'command') {
    const adapter = commandAdapter({ command: req.agent.command, prompt: req.prompt });
    return { adapter, resumed: false };
  }
  const sessionId = deps.store.sessions.get(req.ref, req.folder);
  const adapter: AgentAdapter = claudeAdapter({ ...req.agent, sessionId, prompt: req.prompt });
  return { adapter, resumed: sessionId !== null };
}

const missingFolder = (folder: string) =>
  `The folder ${folder} does not exist. Was the project moved? Remove it from Elaia and add it again.`;

const missingCommand = (command: string, agent: AgentChoice) =>
  `The agent command "${command}" was not found. Install it, or set ` +
  `${agent.kind === 'claude' ? 'elaia.claudePath' : 'elaia.agentCommand'}.`;

// One chat turn, start to finish: run the agent, filter its output, keep everything.
export function startTurn(deps: ChatDeps, req: TurnRequest): Turn {
  const say = (kind: ThreadEntry['kind'], text: string): ThreadEntry => ({
    at: deps.now(),
    kind,
    text,
    shown: true,
    source: 'chat',
  });
  const record = (entries: ThreadEntry[]) => {
    if (entries.length === 0) return;
    deps.store.threads.append(req.ref, entries);
    deps.emit(req.ref, entries);
  };
  if (req.text) record([say('you', req.text)]);
  if (!existsSync(req.folder)) {
    record([say('error', missingFolder(req.folder))]);
    return { done: Promise.resolve({ resumeFailed: false, context: null }), stop: () => undefined };
  }

  const { adapter, resumed } = adapterFor(deps, req);
  const agents = (e: AgentEvent) => deps.agents?.(req.ref, e);
  const events = eventHandler({
    ...deps,
    ref: req.ref,
    folder: req.folder,
    resumed,
    record,
    agents,
  });
  const proc = startProcess({
    command: adapter.command,
    args: adapter.args,
    cwd: req.folder,
    input: adapter.input,
    env: memoryEnv(deps.store.root),
    onLine(line) {
      deps.store.runs.appendChat(req.ref, [line]);
      events.handle(adapter.parseLine(line));
    },
  });
  const done = proc.done.then((ended): TurnResult => {
    if (ended.stopped) record([say('progress', 'Stopped.')]);
    else if (ended.missing) record([say('error', missingCommand(adapter.command, req.agent))]);
    else events.handle(adapter.finish(ended.code, ended.stderr));
    return { resumeFailed: events.resumeFailed(), context: events.context() };
  });
  return { done, stop: proc.stop };
}
