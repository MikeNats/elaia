import type { AgentEvent } from '@/agents';
import { threadKey, type LiveAgent, type ProjectState, type ThreadRef } from '@/shared';
import { postSnapshot } from './record';
import type { AppState } from './types';

const QUIET_MS = 300;
// The popup shows every step; a long run keeps its latest ones.
const STEPS_MAX = 100;

// Agents a chat has running right now, by thread: what each was asked, and its latest step.
export function noteAgent(app: AppState, ref: ThreadRef, e: AgentEvent): void {
  const key = threadKey(ref);
  if (e.kind === 'tokens') {
    app.liveTokens.set(key, { ref, tokens: e.tokens });
    return snapshotSoon(app);
  }
  const now = app.live.get(key) ?? new Map<string, LiveAgent>();
  if (e.kind === 'agent-start') {
    const started = { startedAt: app.deps.now(), steps: [], task: e.task ?? '' };
    now.set(e.id, { about: e.about, doing: 'starting…', ...started });
  } else if (e.kind === 'agent-step') {
    const agent = now.get(e.id);
    const steps = [...(agent?.steps ?? []), e.doing].slice(-STEPS_MAX);
    if (agent) now.set(e.id, { ...agent, doing: e.doing, steps });
  } else if (e.kind === 'agent-end') now.delete(e.id);
  else return;
  app.live.set(key, now);
  snapshotSoon(app);
}

// The turn ended: nothing it started is still running. glafka's own step (glafka-…) is not
// the turn's; it ends on its own.
export function clearAgents(app: AppState, ref: ThreadRef): void {
  const key = threadKey(ref);
  // Its real token total is saved by now: show that instead of the live count.
  app.liveTokens.delete(key);
  const state = app.projects.get(ref.project);
  if (state) state.chatTokens = app.deps.store.tokens.read(ref.project);
  const now = app.live.get(key);
  if (!now) return;
  for (const id of now.keys()) if (!id.startsWith('glafka-')) now.delete(id);
  if (now.size === 0) app.live.delete(key);
  snapshotSoon(app);
}

export function liveView(app: AppState): Record<string, LiveAgent[]> {
  const view: Record<string, LiveAgent[]> = {};
  for (const [key, agents] of app.live) if (agents.size > 0) view[key] = [...agents.values()];
  return view;
}

// Saved chat tokens plus what each running turn used so far.
export function withLiveTokens(app: AppState, project: ProjectState): ProjectState {
  const live = [...app.liveTokens.values()].filter((l) => l.ref.project === project.path);
  if (live.length === 0) return project;
  const chatTokens = { ...project.chatTokens };
  for (const { ref, tokens: t } of live) {
    const old = chatTokens[ref.thread] ?? {
      in: 0,
      out: 0,
      cacheRead: 0,
      cacheWrite: 0,
      costUsd: 0,
    };
    chatTokens[ref.thread] = {
      in: old.in + t.in,
      out: old.out + t.out,
      cacheRead: old.cacheRead + t.cacheRead,
      cacheWrite: old.cacheWrite + t.cacheWrite,
      costUsd: old.costUsd,
    };
  }
  return { ...project, chatTokens };
}

// Steps come fast; the tree and panel need them a few times a second at most.
function snapshotSoon(app: AppState): void {
  if (app.liveTimer) return;
  app.liveTimer = setTimeout(() => {
    app.liveTimer = null;
    postSnapshot(app);
  }, QUIET_MS);
  app.liveTimer.unref?.();
}
