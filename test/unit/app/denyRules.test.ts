import { describe, expect, it } from 'vitest';
import { denyRulesFor } from '@/app/denyRules';
import type { AppState } from '@/app/types';
import { PROJECT_THREAD } from '@/shared';
import { blockedBy } from '../../support/claudeRules';
import { makeTicket } from '../../support/ticket';

const project = '/repo';
const T1 = '2026-10-13-add-csv-export';
// Starts with T1's id, so a rule for one ticket must not catch the other.
const T2 = '2026-10-13-add-csv-export-v2';
const EPIC = 'epic-publish-polish';

// Only what denyRulesFor reads: settings that pick glafka, and the project's tickets.
// T1 is still being planned, so its chat also gets the planner's rules.
const state = {
  deps: { settings: () => ({ workflow: 'glafka', glafkaPath: 'glafka' }) },
  projects: new Map([
    [project, { tickets: [makeTicket({ id: T1, planned: false }), makeTicket({ id: T2 })] }],
  ]),
} as unknown as AppState;

const rulesIn = (thread: string) => denyRulesFor(state, { project, thread }, {});

describe('a ticket chat keeps to its own ticket', () => {
  it.each([
    `glafka cancel --force ${T2}`,
    `glafka ergon --background ${T2}`,
    `glafka lysis --force ${T2}`,
    `glafka poreia ${T2}`,
    `glafka cancel "${T2}"`,
    `glafka cancel '${T2}' --force`,
    `node .glafka/bin/glafka.js lysis ${T2} --force`,
    `/usr/local/bin/glafka cancel ${T2}`,
  ])('blocks %s', (command) => {
    expect(blockedBy(rulesIn(T1), command)).toBe(true);
  });

  it.each([
    `glafka vima ${T1}`,
    `glafka spec ${T1} docs/glafka/tickets/${T1}/spec.md --title "x"`,
    `glafka psyche ${T1} --code "plan and create first"`,
    `glafka psyche ${T1} --code "install deps first"`,
    `glafka apofasi ${T1} "note"`,
    'glafka poreia --all',
  ])('lets %s run', (command) => {
    expect(blockedBy(rulesIn(T1), command)).toBe(false);
  });

  it('lets a ticket whose id starts with another id run its own steps', () => {
    expect(blockedBy(rulesIn(T2), `glafka vima ${T2}`)).toBe(false);
    expect(blockedBy(rulesIn(T2), `glafka cancel --force ${T1}`)).toBe(true);
  });
});

describe('the glafka steps blocked today hold for other spellings', () => {
  it.each([
    `env glafka plan ${T1} plan.md`,
    `/usr/local/bin/glafka ergon ${T1}`,
    'npx glafka heureka "idea"',
    `node .glafka/bin/glafka.js epistle ${T1}`,
    'glafka create "idea"',
  ])('blocks %s in a ticket chat still planning', (command) => {
    expect(blockedBy(rulesIn(T1), command)).toBe(true);
  });
});

describe('commands for every ticket stay in the main chat', () => {
  const shared = [
    'glafka vima --all',
    'glafka vima --all --restart',
    `glafka lysis ${T1} --sweep`,
    'glafka guardrails --level 2',
    'glafka guardrails --install-hook',
    'glafka odysse --keep 1',
    'glafka odysse --workspace-keep 1',
    'glafka install claude',
    'glafka install',
  ];

  it.each(shared)('blocks %s in a ticket chat and an epic chat', (command) => {
    expect(blockedBy(rulesIn(T1), command)).toBe(true);
    expect(blockedBy(rulesIn(EPIC), command)).toBe(true);
  });

  it.each(shared)('lets the main chat run %s', (command) => {
    expect(blockedBy(rulesIn(PROJECT_THREAD), command)).toBe(false);
  });
});
