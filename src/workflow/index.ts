import { glafkaWorkflow } from './glafka';
import type { Workflow } from './types';

export type {
  CommandResult,
  FinishedRun,
  NextStep,
  SetupFinding,
  SetupItem,
  SetupRun,
  TicketBrief,
  TicketPlace,
  TypedStep,
  Workflow,
} from './types';

// Every ticket tool Elaia can drive. To plug in another one: write its
// Workflow, add it here, and add its name to elaia.workflow in package.json.
export const WORKFLOW_IDS = ['glafka'] as const;
export type WorkflowId = (typeof WORKFLOW_IDS)[number];

export interface WorkflowSettings {
  workflow: WorkflowId;
  glafkaPath: string;
}

const MAKERS: Record<WorkflowId, (s: WorkflowSettings) => Workflow> = {
  glafka: (s) => glafkaWorkflow(s.glafkaPath),
};

// The tool a project uses: the one already installed there, else your default.
export function workflowFor(project: string, settings: WorkflowSettings): Workflow {
  const installed = WORKFLOW_IDS.map((id) => MAKERS[id](settings)).find((w) =>
    w.isInstalled(project),
  );
  return installed ?? MAKERS[settings.workflow](settings);
}
