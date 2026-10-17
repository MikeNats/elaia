import type { Line } from './claudeShape';
import type { AgentEvent } from './types';

const num = (record: Record<string, unknown> | undefined, key: string) =>
  typeof record?.[key] === 'number' ? (record[key] as number) : 0;

// How full the main agent's context was at this step: everything the model read and wrote.
export function contextUsed(line: Line): number | null {
  if (line.type !== 'assistant' || line.parent_tool_use_id) return null;
  const usage = line.message?.usage;
  if (!usage) return null;
  const keys = ['input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];
  return keys.reduce((sum, key) => sum + num(usage, key), 0) + num(usage, 'output_tokens');
}

// This turn's tokens so far: the main agent's calls, each counted once.
export function tokensSoFar(
  line: Line,
  calls: Map<string, Record<string, unknown>>,
): AgentEvent | null {
  const usage = line.message?.usage;
  const id = line.message?.id;
  if (line.type !== 'assistant' || line.parent_tool_use_id || !usage || !id) return null;
  calls.set(id, usage);
  const sum = (key: string) => [...calls.values()].reduce((n, u) => n + num(u, key), 0);
  return {
    kind: 'tokens',
    tokens: {
      in: sum('input_tokens'),
      out: sum('output_tokens'),
      cacheRead: sum('cache_read_input_tokens'),
      cacheWrite: sum('cache_creation_input_tokens'),
    },
  };
}

// The context size of the model that did the work (a result line names every model used).
export function contextWindow(line: Line): number | null {
  const models = Object.values(line.modelUsage ?? {});
  const sizes = models.map((m) => m.contextWindow ?? 0).filter((n) => n > 0);
  return sizes.length > 0 ? Math.max(...sizes) : null;
}
