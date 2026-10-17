import { describeRequest } from '@/agents';
import type { ThreadEntry } from '@/shared';
import { approvalFor } from './filter';

const OLD_CARD = /^Not allowed yet: (\S+) — ([\s\S]*)$/;

// Cards saved before the plain-words card read "Not allowed yet: Skill — {raw JSON}".
// Shown again in the new form; the saved file stays as it is.
export function upgradeOldCard(entry: ThreadEntry): ThreadEntry {
  const match = entry.kind === 'approval' ? OLD_CARD.exec(entry.text) : null;
  const allow = entry.actions?.find((a) => a.kind === 'allow')?.value;
  if (!match || !allow) return entry;
  const [, tool = '', raw = ''] = match;
  const wants = describeRequest(tool, oldInput(tool, raw));
  return approvalFor([{ tool, summary: raw, wants, allow }], entry.at)[0] ?? entry;
}

// The old card kept only a summary: the command, a file path, or the input as JSON.
function oldInput(tool: string, raw: string): unknown {
  if (tool === 'Bash') return { command: raw };
  try {
    return JSON.parse(raw);
  } catch {
    return { file_path: raw, url: raw, skill: /"skill":"([^"]+)"/.exec(raw)?.[1] };
  }
}
