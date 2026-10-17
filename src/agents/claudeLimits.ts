import type { AgentEvent } from './types';
import type { Line } from './claudeShape';

// Claude's names for its windows, in words. A window it adds later shows under its own name.
const WINDOW_LABELS: Record<string, string> = {
  five_hour: 'Session (5h)',
  seven_day: 'Week',
  seven_day_opus: 'Week (Opus)',
  seven_day_sonnet: 'Week (Sonnet)',
};

export function limitsOf(line: Line): AgentEvent[] {
  const windows = Object.entries(line.rate_limit_info?.unifiedWindows ?? {}).map(([id, w]) => ({
    id,
    label: WINDOW_LABELS[id] ?? id.replace(/_/g, ' '),
    used: w.utilization,
    resetsAt: w.resetsAt ? new Date(w.resetsAt * 1000).toISOString() : null,
  }));
  return windows.length > 0 ? [{ kind: 'limits', provider: 'Claude', windows }] : [];
}
