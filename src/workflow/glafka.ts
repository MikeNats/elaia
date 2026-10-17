import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  agentCommandFor,
  baseRefFor,
  endedRuns,
  glafkaClient,
  glafkaDir,
  runGlafka,
  hasCoder,
  isTicketChange,
  lastResult,
  SETUP_KEYS,
  setupPrompt,
  setupStatus,
  WORKTREES_DIR,
  type SetupKey,
  glafkaSetupSteps,
  glafkaTrust,
} from '@/glafka';
import {
  GLAFKA_NEW_TICKET_RULES,
  glafkaTicketGenesisPrompt,
  glafkaTicketRules,
  glafkaTypedStep,
  planFileOf,
} from './glafkaText';
import type { Workflow } from './types';

const docsDir = (project: string) => path.join(project, 'docs', 'glafka');
// A glafka command in both forms its skills use: on PATH, and the project's own copy.
const commands = (names: string[]) =>
  names.flatMap((name) => [`Bash(glafka ${name}:*)`, `Bash(node .glafka/bin/glafka.js ${name}:*)`]);
// The steps that act on one ticket by its id.
const TICKET_STEPS = [
  'lysis',
  'cancel',
  'vima',
  'ergon',
  'plan',
  'spec',
  'epistle',
  'psyche',
  'apofasi',
];
// `glafka plan` can set up containers, a database and the dev server.
const PLAN_TIMEOUT = 900_000;
const isSetupKey = (key: string): key is SetupKey =>
  (SETUP_KEYS as readonly string[]).includes(key);

// glafka as an Elaia workflow: its CLI for tickets, its files for setup and runs.
export function glafkaWorkflow(bin: string): Workflow {
  const client = glafkaClient(bin);
  return {
    id: 'glafka',
    name: 'glafka',
    isInstalled: (project) => existsSync(glafkaDir(project)),
    stateDir: glafkaDir,
    isTicketChange,
    worktreesDir: WORKTREES_DIR,
    // glafka's skills fall back to the project's own copy when `glafka` is not on PATH.
    allowedTools: ['Bash(glafka:*)', 'Bash(node .glafka/bin/glafka.js:*)'],
    // A worktree (plan, heureka) or a coder (ergon) starts only from Elaia's Start button.
    plannerDenied: commands(['plan', 'ergon', 'heureka']),
    createDenied: commands(['create', 'genesis', 'heureka']),
    otherTicketsDenied: (ids) =>
      ids.flatMap((id) => commands(TICKET_STEPS.map((step) => `${step} ${id}`))),
    pushOnly: commands(['epistle']),
    // glafka's own code and state: an agent that rewrites bin/glafka.js could then run anything.
    lockedFiles: ['.glafka/**'],
    // Where glafka reads the commands it runs (coder, checks) and its guardrails.
    lockedOutsideMain: [
      '.glafka.json',
      'docs/glafka/guardrails.json',
      'docs/glafka/architecture/isolation.json',
    ],
    docsDir,
    baseRef: baseRefFor,
    agentCommand: agentCommandFor,
    ...glafkaTrust,
    setupStatus,
    install: (project, platform) => client.install(project, platform),
    ...glafkaSetupSteps(bin),
    setupPrompt: (missing) => setupPrompt(missing.filter(isSetupKey)),
    tickets: client.tickets,
    ticket: client.ticket,
    tokens: client.tokens,
    create: client.create,
    advance: client.advance,
    planFile: planFileOf,
    startWork: (project, id) => runGlafka(bin, ['plan', id, planFileOf(id)], project, PLAN_TIMEOUT),
    startCoder: (project, id) => runGlafka(bin, ['ergon', id, '--background'], project),
    close: (project, id) => runGlafka(bin, ['lysis', id], project, 300_000),
    cancel: (project, id) => runGlafka(bin, ['cancel', id], project, 300_000),
    finishedRuns: endedRuns,
    lastWords: lastResult,
    cannotRunAlone: (project) =>
      hasCoder(project)
        ? null
        : 'No coder agent is set (agents.coder in .glafka.json), so tickets cannot run on their own. ' +
          'Press Set up in this chat to add one.',
    newTicketRules: GLAFKA_NEW_TICKET_RULES,
    ticketGenesisPrompt: glafkaTicketGenesisPrompt,
    ticketRules: glafkaTicketRules,
    typedStep: glafkaTypedStep,
    pushPrompt: (id) => `/glafka:epistle ${id}`,
  };
}
