import { renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { appendLines, readLines } from './files';

const RowSchema = z.object({
  at: z.string(),
  project: z.string(),
  thread: z.string(),
  // What it cost at API prices, as the agent reported it, and all tokens it used.
  cost: z.number(),
  tokens: z.number(),
  source: z.enum(['chat', 'run']),
});
export type UsageRow = z.infer<typeof RowSchema>;

// Everything Elaia ran, with when: chat turns and glafka's runs. The usage bar sums it.
export function usageStore(root: string) {
  const file = path.join(root, 'usage.jsonl');
  return {
    add: (row: UsageRow) => appendLines(file, [JSON.stringify(row)]),
    since: (iso: string): UsageRow[] => readLines(file, RowSchema).filter((r) => r.at >= iso),
    // Rows before `iso` go. A temp file, then rename, so a crash never leaves half a file;
    // nothing is written when no row is older.
    drop(iso: string): void {
      const rows = readLines(file, RowSchema);
      const kept = rows.filter((r) => r.at >= iso);
      if (kept.length === rows.length) return;
      const temp = `${file}.${process.pid}.tmp`;
      writeFileSync(temp, kept.map((r) => `${JSON.stringify(r)}\n`).join(''));
      renameSync(temp, file);
    },
  };
}
