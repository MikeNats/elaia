import { createTurns } from '@/chat';
import { PROJECT_THREAD, threadKey, type ThreadRef } from '@/shared';
import { chatActions } from './chatActions';
import { ticketActions } from './ticketChat';
import { addProject, loadProjects, removeProject, syncProjects } from './projects';
import { postSnapshot, workflowOf } from './record';
import { offerSetup, setupActions } from './setup';
import { approveEpic } from './epicApprove';
import { saveInbox } from './inbox';
import type { Approval } from '@/epics';
import { advanceByHand } from './advance';
import { keepAllNow } from './keep';
import { dropQueued } from './queue';
import { setViewing } from './attention';
import { refresh } from './refresh';
import { storeChanged } from './storeWatch';
import { threadPage } from './ticketIntro';
import type { AppDeps, AppState } from './types';

export type { AppDeps, Settings, AgentKind } from './types';
export { AGENT_KINDS, PLATFORMS, PERMISSION_MODES, SettingsSchema } from './types';
export { REPO_SETTINGS, settingsFrom, type ConfigSource } from './settings';

import { refreshLimits } from './limitsRefresh';

// Everything Elaia keeps in memory while it runs.
function newState(deps: AppDeps): AppState {
  return {
    deps,
    projects: new Map(),
    turns: createTurns(),
    refreshing: new Map(),
    again: new Set(),
    advancing: new Set(),
    explainedStops: new Set(),
    setupAnswered: new Set(),
    setupSteps: new Map(),
    starting: new Set(),
    autoStarted: new Set(),
    keeping: new Map(),
    handingOver: new Map(),
    attention: new Map(),
    live: new Map(),
    liveTokens: new Map(),
    queued: new Map(),
    disposed: false,
    liveTimer: null,
    viewing: null,
    known: new Map(),
    opened: new Set(),
    limitsAsk: { running: false, failed: false, lastAt: null },
  };
}

// The core of Elaia, with no VS Code in it: the host feeds it messages and settings.
export function createApp(deps: AppDeps) {
  const app = newState(deps);
  return {
    store: deps.store,
    load: () => loadProjects(app),
    projectPaths: () => [...app.projects.keys()],
    snapshot: () => postSnapshot(app),
    addProject: (p: string) => addProject(app, p),
    removeProject: (p: string) => removeProject(app, p),
    refresh: (p: string) => refresh(app, p),
    syncProjects: () => syncProjects(app),
    refreshAll: () => Promise.all([...app.projects.keys()].map((p) => refresh(app, p))),
    // Your plan's usage, asked for when the last report and the last ask are old, and Claude is
    // your agent. Only while the panel is open.
    refreshLimits: () => refreshLimits(app),
    // The refresh button: ask now, however fresh the numbers are.
    refreshUsage: () => refreshLimits(app, { force: true }),
    advance: async (p: string, id: string) => {
      await advanceByHand(app, p, id);
      await refresh(app, p);
    },
    openThread: (ref: ThreadRef) => {
      app.opened.add(threadKey(ref));
      if (ref.thread === PROJECT_THREAD) offerSetup(app, ref.project);
      deps.post({ type: 'thread', ref, entries: threadPage(app, ref) });
    },
    // The store's thread files or seen.json changed, in this window or another one.
    storeChanged: (paths: string[]) => storeChanged(app, paths),
    // The webview says which thread is on screen and whether it is scrolled to the bottom.
    viewing: (ref: ThreadRef | null, atBottom: boolean) => {
      if (setViewing(app, ref, atBottom)) postSnapshot(app);
    },
    ...setupActions(app),
    approveEpic: (p: string, slug: string, approval: Approval) =>
      approveEpic(app, p, slug, approval),
    saveInbox: (p: string, files: { name: string; data: string }[]) => saveInbox(app, p, files),
    ...ticketActions(app),
    workflowFor: (p: string) => workflowOf(app, p),
    ...chatActions(app),
    ticket: (ref: ThreadRef) =>
      app.projects.get(ref.project)?.tickets.find((t) => t.id === ref.thread) ?? null,
    dispose: () => {
      // Nothing new may start now; waiting messages are dropped, and their chats say so.
      app.disposed = true;
      dropQueued(app);
      app.turns.stopAll();
      // After the Not sent lines, so they are written into the repo too.
      keepAllNow(app);
    },
  };
}

export type App = ReturnType<typeof createApp>;
