import path from 'node:path';
import { z } from 'zod';
import { APPROVALS } from '@/epics';
import { readJson, writeJson } from './files';

// Your epic approvals, kept here and not in the repo: an agent or a commit can write epic.json,
// but only the Approve button writes this file.
const ApprovalSchema = z.object({
  approval: z.enum(APPROVALS),
  // The plan you approved (planHash). A changed plan needs a new approval.
  plan: z.string(),
  at: z.string(),
});
export type SavedApproval = z.infer<typeof ApprovalSchema>;
const FileSchema = z.record(z.string(), ApprovalSchema);

export function approvalsStore(root: string) {
  const file = path.join(root, 'approvals.json');
  const key = (project: string, slug: string) => `${project}::${slug}`;
  const all = () => readJson(file, FileSchema, {});
  return {
    get: (project: string, slug: string): SavedApproval | null => all()[key(project, slug)] ?? null,
    set: (project: string, slug: string, value: SavedApproval) =>
      writeJson(file, { ...all(), [key(project, slug)]: value }),
  };
}
