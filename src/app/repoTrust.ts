import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CLAUDE_TRUST_FILES, claudeRunnables } from '@/agents';
import type { Runnable } from '@/shared';
import { workflowFor } from '@/workflow';
import type { AppState } from './types';

export const UNREADABLE = 'could not read this file';

type Lister = (file: string, json: unknown) => Runnable[];

// One file's items. Missing: none. Not JSON: one item holding its raw text, so a broken file
// still asks (Claude or glafka may read it another way).
function itemsOf(project: string, file: string, list: Lister): Runnable[] {
  const full = path.join(project, file);
  if (!existsSync(full)) return [];
  let raw = '';
  try {
    raw = readFileSync(full, 'utf8');
    return list(file, JSON.parse(raw));
  } catch {
    return [{ file, what: UNREADABLE, run: raw }];
  }
}

// Everything this repo can make run: Claude's files first, then the workflow's.
export function repoRunnables(app: AppState, project: string): Runnable[] {
  // Not workflowOf: that one asks trustedNow, which asks this.
  const workflow = workflowFor(project, app.deps.settings());
  const tool: Lister = (file, json) => workflow.runnables(file, json);
  return [
    ...CLAUDE_TRUST_FILES.flatMap((file) => itemsOf(project, file, claudeRunnables)),
    ...workflow.trustFiles.flatMap((file) => itemsOf(project, file, tool)),
  ];
}

const cmp = (x: string, y: string) => (x < y ? -1 : x > y ? 1 : 0);

// The same items give the same hash, in any order.
export function trustHash(items: Runnable[]): string {
  const sorted = [...items]
    .sort((a, b) => cmp(a.file, b.file) || cmp(a.what, b.what) || cmp(a.run, b.run))
    .map((r) => [r.file, r.what, r.run]);
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

// You pressed Trust for exactly what this repo can make run now. A repo with nothing to run is
// trusted on its own: there is nothing to ask about, and a later change still asks.
export function trustedNow(app: AppState, project: string): boolean {
  const items = repoRunnables(app, project);
  const hash = trustHash(items);
  if (app.deps.store.trusted.get(project) === hash) return true;
  if (items.length > 0) return false;
  app.deps.store.trusted.set(project, hash);
  return true;
}

// What the repo can make run now counts as trusted: after Trust, and after Elaia's own setup.
export function keepTrust(app: AppState, project: string): void {
  app.deps.store.trusted.set(project, trustHash(repoRunnables(app, project)));
}
