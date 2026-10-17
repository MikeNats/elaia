import { existsSync } from 'node:fs';
import type { App } from '@/app';
import { watchFolder } from '@/track';

// A safety net: some states (a stalled coder) change with time, not with a file write.
const REFRESH_MS = 60_000;

// The thread files and seen.json in the store every window shares. What any window writes there
// reaches every other window through these.
const THREAD_FILE = /^threads\/[^/]+\/[^/]+\.jsonl$/;
const storeFile = (p: string) => THREAD_FILE.test(p) || p === 'seen.json';

// One watcher per project on its .glafka/ folder, one on the shared store, plus a slow timer for
// everything else. `tick` runs before each timed refresh (the window renews its leader lease there).
export function createWatchers(app: App, tick: () => void, panelOpen: () => boolean = () => false) {
  const stops = new Map<string, () => void>();
  // Every window, leader or not: a window only reads here, so two never write the same line.
  const stopStore = watchFolder(app.store.root, (paths) => app.storeChanged(paths), {
    relevant: storeFile,
  });
  function sync(): void {
    const wanted = new Set(app.projectPaths());
    for (const project of wanted) {
      if (stops.has(project)) continue;
      const workflow = app.workflowFor(project);
      // Not set up yet: nothing to watch. Setup calls sync again once it is.
      if (!existsSync(workflow.stateDir(project))) continue;
      const stop = watchFolder(workflow.stateDir(project), () => void app.refresh(project), {
        relevant: workflow.isTicketChange,
      });
      stops.set(project, stop);
    }
    for (const [project, stop] of stops) {
      if (wanted.has(project)) continue;
      stop();
      stops.delete(project);
    }
  }
  const timer = setInterval(() => {
    tick();
    // Your plan's usage, asked for when the last report and ask are old, only while you can see it.
    if (panelOpen()) void app.refreshLimits();
    // A project added in another window is picked up here, so the leader tracks it too.
    app.syncProjects();
    sync();
    void app.refreshAll();
  }, REFRESH_MS);
  return {
    sync,
    dispose(): void {
      clearInterval(timer);
      stopStore();
      for (const stop of stops.values()) stop();
      stops.clear();
    },
  };
}
