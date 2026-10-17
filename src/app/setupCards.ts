import { PROJECT_THREAD, type EntryAction, type ThreadRef } from '@/shared';
import type { SetupFinding, SetupItem } from '@/workflow';
import { chatTurn } from './chat';
import { commitCard } from './setupCommit';
import { note, record, workflowOf } from './record';
import type { AppState } from './types';

export const projectRef = (project: string): ThreadRef => ({ project, thread: PROJECT_THREAD });

export function stepsOf(app: AppState, project: string): Set<string> {
  const steps = app.setupSteps.get(project) ?? new Set<string>();
  app.setupSteps.set(project, steps);
  return steps;
}

export const stepButton = (key: string, choice: string, label: string): EntryAction => ({
  kind: 'setup-step',
  label,
  value: `${key}:${choice}`,
});

// A setup card, unless the same card is already the last one in the chat.
export function setupCard(app: AppState, project: string, text: string, actions: EntryAction[]) {
  const ref = projectRef(project);
  const cards = app.deps.store.threads
    .read(ref)
    .filter((e) => e.actions?.some((a) => a.kind === 'setup-step'));
  if (cards.at(-1)?.text === text) return;
  record(app, ref, [
    { at: app.deps.now(), kind: 'approval', text, shown: true, source: 'glafka', actions },
  ]);
}

// "run checks with: npm run check" → the command in code font.
const line = (item: string) => {
  const at = item.indexOf(': ');
  return at < 0 ? `- ${item}` : `- ${item.slice(0, at)}: \`${item.slice(at + 2)}\``;
};

function findingCard(app: AppState, project: string, finding: SetupFinding) {
  const text = [`**${finding.title}**`, '', ...finding.items.map(line)].join('\n');
  setupCard(app, project, text, [
    stepButton(finding.key, 'keep', finding.keep),
    stepButton(finding.key, 'change', 'Change'),
  ]);
}

function optionalCard(app: AppState, project: string, item: SetupItem) {
  setupCard(app, project, `**${item.label}** — not set up (optional).`, [
    stepButton(item.key, 'explain', 'Explain'),
    stepButton(item.key, 'skip', 'Skip'),
  ]);
}

// The next setup step: a card to answer, the chat for what only an agent can do, or done.
// `chat` is false right after a chat turn: the chat may be waiting for your answer.
export async function nextSetup(app: AppState, project: string, chat: boolean): Promise<void> {
  const workflow = workflowOf(app, project);
  const steps = stepsOf(app, project);
  const finding = (await workflow.setupFindings(project)).find((f) => !steps.has(f.key));
  if (finding) return findingCard(app, project, finding);
  const items = workflow.setupStatus(project);
  const missing = items.filter((i) => !i.done && !i.optional).map((i) => i.key);
  // Right after a chat turn: the chat is still on it, maybe asking you. One thing at a time.
  if (missing.length > 0 && !chat) return;
  const optional = items.find((i) => i.optional && !i.done && !steps.has(i.key));
  if (optional) return optionalCard(app, project, optional);
  if (missing.length > 0)
    return chatTurn(app, projectRef(project), '', workflow.setupPrompt(missing));
  const files = workflow.setupFiles(project);
  if (files.length > 0 && !steps.has('commit')) return commitCard(app, project, files);
  if (steps.has('complete')) return;
  steps.add('complete');
  note(app, projectRef(project), 'progress', 'Setup is complete.');
}
