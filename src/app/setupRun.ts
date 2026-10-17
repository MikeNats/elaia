import type { ThreadEntry, ThreadRef } from '@/shared';
import type { CommandResult } from '@/workflow';
import { chatTurn } from './chat';
import { messageOf, note, record, workflowOf } from './record';
import { refresh } from './refresh';
import { nextSetup, projectRef, stepsOf } from './setupCards';
import { commitSetup } from './setupCommit';
import type { AppState } from './types';

// One line you see; the command's own output as a text box: in the details when it worked,
// shown when it failed.
function resultNote(
  app: AppState,
  ref: ThreadRef,
  ok: string,
  failed: string,
  result: CommandResult,
) {
  const worked = result.code === 0;
  const tail = (result.stdout + result.stderr).trim().split('\n').slice(-12).join('\n');
  const line = (kind: ThreadEntry['kind'], text: string, shown: boolean): ThreadEntry => ({
    at: app.deps.now(),
    kind,
    text,
    shown,
    source: 'glafka',
  });
  record(app, ref, [
    line(worked ? 'progress' : 'error', worked ? ok : failed, true),
    ...(tail ? [line('progress', `\`\`\`text\n${tail}\n\`\`\``, !worked)] : []),
  ]);
}

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
  // Setup is under way: the card would only come back with each finished step.
  app.setupAnswered.add(project);
  stepsOf(app, project).clear();
  record(app, ref, [
    { at: app.deps.now(), kind: 'you', text: 'Set up', shown: true, source: 'chat' },
  ]);
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
  if (choice === 'keep')
    resultNote(app, ref, 'Kept.', 'Keeping it failed.', await workflow.keepFinding(project, key));
  if (choice === 'commit') await commitSetup(app, project);
  if (choice === 'change')
    return chatTurn(app, ref, '', await workflow.changeFinding(project, key));
  if (choice === 'explain') return chatTurn(app, ref, '', workflow.setupPrompt([key]));
  await nextSetup(app, project, true);
}
