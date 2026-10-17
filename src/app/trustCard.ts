import type { ThreadRef } from '@/shared';
import { runHeld } from './chat';
import { chatEntry, note, record } from './record';
import { refresh } from './refresh';
import { keepTrust, repoRunnables, trustedNow, trustHash } from './repoTrust';
import { offerSetup } from './setup';
import { projectRef } from './setupCards';
import { trustCardText } from './trustText';
import type { TurnOptions } from './turnOnce';
import type { AppState } from './types';

export const NOT_TRUSTED_TURN =
  'Elaia did not start the agent: this repo is not trusted yet. Press Trust in the main chat.';
export const NOT_TRUSTED_SETUP =
  'Elaia did not run Set up: this repo is not trusted yet. Press Trust in the main chat.';
export const TRUSTED = 'Trusted. Elaia asks again when this list changes.';
export const NOT_NOW = 'Nothing from this repo runs until you press Trust.';
export const TRUST_CHANGED =
  'What this repo can run changed since that card. Read the new card, then press Trust there.';

// The card in the main chat while the repo can run things you have not trusted. Not twice in a
// row since the last Clear. After Not now only your own action (force) shows it again.
export function offerTrust(app: AppState, project: string, force = false): void {
  if (trustedNow(app, project)) return;
  const declined = app.trustDeclined.has(project);
  if (declined && !force) return;
  const ref = projectRef(project);
  const items = repoRunnables(app, project);
  const hash = trustHash(items);
  const thread = app.deps.store.threads.read(ref);
  const shown = thread.slice(thread.findLastIndex((e) => e.kind === 'cleared') + 1);
  const last = shown.flatMap((e) => e.actions ?? []).findLast((a) => a.kind === 'trust');
  // By hash, not text: the card can read the same while what Trust checks has changed.
  if (!declined && last?.value === hash) return;
  app.trustDeclined.delete(project);
  record(app, ref, [
    {
      ...chatEntry(app, 'approval', trustCardText(project, items)),
      actions: [
        { kind: 'trust', label: 'Trust', value: hash },
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
  // What waited for Trust goes on now: an epic's tickets, then your held messages.
  await refresh(app, project);
  await runHeld(app, project);
}

export function notNowTrust(app: AppState, project: string): void {
  const ref = projectRef(project);
  record(app, ref, [chatEntry(app, 'you', 'Not now')]);
  app.trustDeclined.add(project);
  note(app, ref, 'progress', NOT_NOW);
}

// A turn that waits for your Trust. Your line shows now; the turn runs once, after Trust.
export function holdForTrust(app: AppState, ref: ThreadRef, text: string, opts: TurnOptions) {
  if (text && !opts.queued) record(app, ref, [chatEntry(app, 'you', text)]);
  const held = app.heldForTrust.get(ref.project) ?? [];
  app.heldForTrust.set(ref.project, [...held, { ref, text, prompt: opts.prompt, push: opts.push }]);
}

export const trustActions = (app: AppState) => ({
  trust: (p: string, hash: string) => trustRepo(app, p, hash),
  notNowTrust: (p: string) => notNowTrust(app, p),
});
