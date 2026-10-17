import type { SetupRun, Workflow } from './types';

export const NOT_TRUSTED_GLAFKA =
  'Elaia did not run glafka: this repo is not trusted yet. Press Trust in the main chat.';

// A tool command refused because you have not trusted the repo yet.
export class NotTrustedError extends Error {
  constructor() {
    super(NOT_TRUSTED_GLAFKA);
    this.name = 'NotTrustedError';
  }
}

type Method = {
  [K in keyof Workflow]-?: Workflow[K] extends (...args: never[]) => unknown ? K : never;
}[keyof Workflow];

// What each method can do. reads: files and status only. runs: it can make the repo's own
// commands run (agents, checks, setup, the dev server). steps: it returns steps that run.
// A new method must be sorted here, or TypeScript fails.
const KIND: Record<Method, 'reads' | 'runs' | 'steps'> = {
  isInstalled: 'reads',
  stateDir: 'reads',
  isTicketChange: 'reads',
  otherTicketsDenied: 'reads',
  docsDir: 'reads',
  baseRef: 'reads',
  agentCommand: 'reads',
  runnables: 'reads',
  setupStatus: 'reads',
  setupFiles: 'reads',
  setupPrompt: 'reads',
  tickets: 'reads',
  ticket: 'reads',
  tokens: 'reads',
  planFile: 'reads',
  finishedRuns: 'reads',
  lastWords: 'reads',
  cannotRunAlone: 'reads',
  ticketGenesisPrompt: 'reads',
  ticketRules: 'reads',
  typedStep: 'reads',
  pushPrompt: 'reads',
  install: 'runs',
  setupFindings: 'runs',
  keepFinding: 'runs',
  changeFinding: 'runs',
  create: 'runs',
  advance: 'runs',
  startWork: 'runs',
  startCoder: 'runs',
  close: 'runs',
  cancel: 'runs',
  autoSetup: 'steps',
};

type Call = (...args: unknown[]) => unknown;

// The workflow with every command that can run the repo's own commands refused until
// `trusted()` says yes. Asked at each call, so a Trust pressed later counts at once.
export function guarded(workflow: Workflow, trusted: () => boolean): Workflow {
  const refuse = () => Promise.reject(new NotTrustedError());
  const out: Record<string, unknown> = { ...workflow };
  for (const [key, kind] of Object.entries(KIND) as [Method, string][]) {
    const real = workflow[key] as Call;
    if (kind === 'runs') out[key] = (...args: unknown[]) => (trusted() ? real(...args) : refuse());
    if (kind === 'steps')
      out[key] = (...args: unknown[]) =>
        (real(...args) as SetupRun[]).map((step) => ({
          ...step,
          run: () => (trusted() ? step.run() : refuse()),
        }));
  }
  return out as unknown as Workflow;
}
