import path from 'node:path';
import type { ProjectState } from '@/shared';
import { epicViews } from './epicCard';
import { postSnapshot } from './record';
import { refresh } from './refresh';
import { offerSetup } from './setup';
import { offerTrust } from './trustCard';
import { loadAttention } from './attention';
import type { AppState } from './types';

function stateFor(app: AppState, projectPath: string): ProjectState {
  const { store } = app.deps;
  return {
    path: projectPath,
    name: path.basename(projectPath),
    tickets: Object.values(store.views.read(projectPath)),
    tokens: [],
    chatTokens: store.tokens.read(projectPath),
    epics: epicViews(app, projectPath),
    error: null,
  };
}

// What we knew last time, shown at once; a refresh then brings it up to date.
export function loadProjects(app: AppState): void {
  for (const p of app.deps.store.projects.list()) app.projects.set(p.path, stateFor(app, p.path));
  loadAttention(app);
  postSnapshot(app);
}

// Adds a project and shows what it still needs. Nothing is installed until you press Set up.
export async function addProject(app: AppState, projectPath: string): Promise<void> {
  app.deps.store.projects.add(projectPath);
  app.projects.set(projectPath, stateFor(app, projectPath));
  postSnapshot(app);
  await refresh(app, projectPath);
  // In any window: you added it here. The Set up card waits until it is trusted.
  offerTrust(app, projectPath);
  offerSetup(app, projectPath);
}

// Projects added or removed in another VS Code window: they share one list, not one memory.
export function syncProjects(app: AppState): void {
  const listed = new Set(app.deps.store.projects.list().map((p) => p.path));
  let changed = false;
  for (const p of listed) {
    if (app.projects.has(p)) continue;
    app.projects.set(p, stateFor(app, p));
    changed = true;
  }
  for (const p of app.projects.keys()) {
    if (listed.has(p)) continue;
    app.projects.delete(p);
    changed = true;
  }
  if (changed) postSnapshot(app);
}

export function removeProject(app: AppState, projectPath: string): void {
  app.deps.store.projects.remove(projectPath);
  app.projects.delete(projectPath);
  postSnapshot(app);
}
