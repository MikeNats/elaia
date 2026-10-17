import path from 'node:path';
import { z } from 'zod';
import { ProviderLimitsSchema, type ProviderLimits } from '@/shared';
import { readJson, writeJson } from './files';

const FileSchema = z.record(z.string(), ProviderLimitsSchema);

// The latest plan limits each provider reported, from any chat or run, in any window.
export function limitsStore(root: string) {
  const file = path.join(root, 'limits.json');
  const read = () => readJson(file, FileSchema, {});
  return {
    all: (): ProviderLimits[] => Object.values(read()),
    // A report older than the one kept (a slow run's log read late) does not replace it.
    set(report: ProviderLimits): void {
      const kept = read();
      const old = kept[report.provider];
      if (old && old.at > report.at) return;
      writeJson(file, { ...kept, [report.provider]: report });
    },
  };
}
