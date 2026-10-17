import path from 'node:path';
import type { Runnable } from '@/shared';
import { chatEntry, note, record } from './record';
import { keepTrust, repoRunnables, trustedNow, trustHash, UNREADABLE } from './repoTrust';
import { offerSetup } from './setup';
import { projectRef } from './setupCards';
import type { AppState } from './types';

export const NOT_TRUSTED_TURN =
  'Elaia did not start the agent: this repo is not trusted yet. Press Trust in the main chat.';
export const NOT_TRUSTED_SETUP =
  'Elaia did not run Set up: this repo is not trusted yet. Press Trust in the main chat.';
export const TRUSTED = 'Trusted. Elaia asks again when this list changes.';
export const NOT_NOW = 'Nothing from this repo runs until you press Trust.';
export const TRUST_CHANGED =
  'What this repo can run changed since that card. Read the new card, then press Trust there.';

// In code font, on one line. A backtick inside gets a wider fence.
const code = (run: string) => {
  const one = run.replace(/\r?\n/g, ' ↵ ');
  return one.includes('`') ? `\`\` ${one} \`\`` : `\`${one}\``;
};
const line = (r: Runnable) =>
  r.what === UNREADABLE ? `- ${r.what}` : `- ${r.what}: ${code(r.run)}`;

// What this repo can make run, by file.
export function trustCardText(project: string, items: Runnable[]): string {
  const files = [...new Set(items.map((i) => i.file))];
  const groups = files.flatMap((file) => [
    '',
    file,
    ...items.filter((i) => i.file === file).map(line),
  ]);
  return [
    `**Trust ${path.basename(project)}?**`,
    '',
    'This repo can make these run on your computer:',
    ...groups,
    '',
    'Press Trust only if you trust where this repo came from.',
  ].join('\n');
}

// The card in the main chat while the repo can run things you have not trusted. Not twice in a
// row since the last Clear. After Not now only your own action (force) shows it again.
export function offerTrust(app: AppState, project: string, force = false): void {
  if (trustedNow(app, project)) return;
  const declined = app.trustDeclined.has(project);
  if (declined && !force) return;
  const ref = projectRef(project);
  const items = repoRunnables(app, project);
  const text = trustCardText(project, items);
  const thread = app.deps.store.threads.read(ref);
  const shown = thread.slice(thread.findLastIndex((e) => e.kind === 'cleared') + 1);
  const last = shown.filter((e) => e.actions?.some((a) => a.kind === 'trust')).at(-1);
  if (!declined && last?.text === text) return;
  app.trustDeclined.delete(project);
  record(app, ref, [
    {
      ...chatEntry(app, 'approval', text),
      actions: [
        { kind: 'trust', label: 'Trust', value: trustHash(items) },
        { kind: 'not-trust', label: 'Not now', value: project },
      ],
    },
  ]);
}

// Trust: what the card listed is saved as yours. A card older than the files trusts nothing.
export async function trustRepo(app: AppState, project: string, hash: string): Promise<void> {
  const ref = projectRef(project);
  record(app, ref, [chatEntry(app, 'you', 'Trust')]);
  if (hash !== trustHash(repoRunnables(app, project))) {
    note(app, ref, 'progress', TRUST_CHANGED);
    return offerTrust(app, project, true);
  }
  keepTrust(app, project);
  app.trustDeclined.delete(project);
  note(app, ref, 'progress', TRUSTED);
  offerSetup(app, project);
}

export function notNowTrust(app: AppState, project: string): void {
  const ref = projectRef(project);
  record(app, ref, [chatEntry(app, 'you', 'Not now')]);
  app.trustDeclined.add(project);
  note(app, ref, 'progress', NOT_NOW);
}

export const trustActions = (app: AppState) => ({
  trust: (p: string, hash: string) => trustRepo(app, p, hash),
  notNowTrust: (p: string) => notNowTrust(app, p),
});
