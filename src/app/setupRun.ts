import type { ThreadRef } from '@/shared';
import { chatTurn } from './chat';
import { messageOf, note, record, workflowOf } from './record';
import { refresh } from './refresh';
import { resultNote } from './resultNote';
import { nextSetup, projectRef, stepsOf } from './setupCards';
import { commitSetup } from './setupCommit';
import { trustedNow } from './repoTrust';
import { NOT_TRUSTED_SETUP, offerTrust } from './trustCard';
import type { AppState } from './types';

async function install(app: AppState, ref: ThreadRef): Promise<boolean> {
  const workflow = workflowOf(app, ref.project);
  if (workflow.isInstalled(ref.project)) return true;
  const platform = app.deps.settings().platform;
  note(app, ref, 'progress', `Installing ${workflow.name} (${platform})…`);
  try {
    const result = await workflow.install(ref.project, platform);
    const failed = `${workflow.name} install failed (exit ${result.code}).`;
    resultNote(app, ref, `${workflow.name} installed.`, failed, result);
    if (result.code !== 0) return false;
  } catch (err) {
    note(app, ref, 'error', messageOf(err));
    return false;
  }
  await refresh(app, ref.project);
  return true;
}

// Set up: install, then what the tool does with no agent, then one card at a time. The main
// chat only gets what no command could do.
export async function runSetup(app: AppState, project: string): Promise<void> {
  const ref = projectRef(project);
  record(app, ref, [
    { at: app.deps.now(), kind: 'you', text: 'Set up', shown: true, source: 'chat' },
  ]);
  // Set up runs glafka, which runs the repo's commands. The card stays until you trust it.
  if (!trustedNow(app, project)) {
    note(app, ref, 'error', NOT_TRUSTED_SETUP);
    return offerTrust(app, project, true);
  }
  // Setup is under way: the card would only come back with each finished step.
  app.setupAnswered.add(project);
  stepsOf(app, project).clear();
  try {
    if (!(await install(app, ref))) return;
    const workflow = workflowOf(app, project);
    if (workflow.isInstalled(project)) {
      const missing = workflow
        .setupStatus(project)
        .filter((i) => !i.done)
        .map((i) => i.key);
      for (const step of workflow.autoSetup(project, missing)) {
        note(app, ref, 'progress', `${step.label}…`);
        resultNote(app, ref, step.done, `${step.label} failed.`, await step.run());
      }
    }
    await nextSetup(app, project, true);
  } catch (err) {
    // glafka could not run at all (missing, say). Every next step would fail the same way.
    note(app, ref, 'error', messageOf(err));
  }
}

const SAID: Record<string, string> = {
  keep: 'Keep',
  change: 'Change',
  explain: 'Explain',
  skip: 'Skip',
  commit: 'Commit',
  later: 'Not now',
};

// A button on a setup card. Keep, Skip and Commit go on to the next card; Change and Explain
// hand over to the chat, and setup goes on when its turn ends.
export async function setupStep(app: AppState, project: string, key: string, choice: string) {
  const steps = stepsOf(app, project);
  if (steps.has(key)) return;
  steps.add(key);
  const ref = projectRef(project);
  const workflow = workflowOf(app, project);
  record(app, ref, [
    { at: app.deps.now(), kind: 'you', text: SAID[choice] ?? choice, shown: true, source: 'chat' },
  ]);
  try {
    if (choice === 'keep')
      resultNote(app, ref, 'Kept.', 'Keeping it failed.', await workflow.keepFinding(project, key));
    if (choice === 'commit') await commitSetup(app, project);
    if (choice === 'change')
      return await chatTurn(app, ref, '', await workflow.changeFinding(project, key));
    if (choice === 'explain') return await chatTurn(app, ref, '', workflow.setupPrompt([key]));
    await nextSetup(app, project, true);
  } catch (err) {
    // The button can be pressed again.
    steps.delete(key);
    note(app, ref, 'error', messageOf(err));
  }
}
