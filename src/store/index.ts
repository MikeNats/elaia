import { projectsStore } from './projects';
import { threadsStore } from './threads';
import { sessionsStore } from './sessions';
import { runsStore } from './runs';
import { seenStore } from './seen';
import { modelsStore } from './models';
import { usageStore } from './usage';
import { limitsStore } from './limits';
import { approvalsStore } from './approvals';
import { locksStore } from './locks';
import { trustedStore } from './trusted';
import { publishedStore, tokensStore, viewsStore } from './views';

export type { ProjectEntry } from './projects';
export { projectKey } from './keys';

// Elaia's local files, all under one root (VS Code's global storage for this extension).
export function createStore(root: string) {
  return {
    root,
    projects: projectsStore(root),
    threads: threadsStore(root),
    sessions: sessionsStore(root),
    runs: runsStore(root),
    views: viewsStore(root),
    tokens: tokensStore(root),
    published: publishedStore(root),
    seen: seenStore(root),
    models: modelsStore(root),
    usage: usageStore(root),
    limits: limitsStore(root),
    approvals: approvalsStore(root),
    locks: locksStore(root),
    trusted: trustedStore(root),
  };
}

export type Store = ReturnType<typeof createStore>;
