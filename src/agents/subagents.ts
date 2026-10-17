import type { Line } from './claudeShape';
import { summarizeInput } from './summary';
import type { AgentEvent } from './types';

const STARTS_AGENT = new Set(['Task', 'Agent']);
const TASK_MAX = 4000;

// The agents a chat starts (Task / Agent tool) and what each one is doing right now.
// `running` holds their tool-use ids for this turn.
export function agentsOf(line: Line, running: Set<string>): AgentEvent[] {
  const content = Array.isArray(line.message?.content) ? line.message.content : [];
  const parent = line.parent_tool_use_id;
  if (parent) {
    // A line the agent itself printed: its latest tool call is what it is doing.
    if (line.type !== 'assistant' || !running.has(parent)) return [];
    const use = content.filter((b) => b.type === 'tool_use' && b.name).at(-1);
    if (!use?.name) return [];
    return [
      {
        kind: 'agent-step',
        id: parent,
        doing: `${use.name} — ${summarizeInput(use.name, use.input)}`,
      },
    ];
  }
  const out: AgentEvent[] = [];
  for (const b of content) {
    if (
      line.type === 'assistant' &&
      b.type === 'tool_use' &&
      b.id &&
      STARTS_AGENT.has(b.name ?? '')
    ) {
      running.add(b.id);
      const input = (b.input ?? {}) as Record<string, unknown>;
      const about = typeof input.description === 'string' ? input.description : 'an agent';
      const task = typeof input.prompt === 'string' ? input.prompt.slice(0, TASK_MAX) : '';
      out.push({ kind: 'agent-start', id: b.id, about, task });
    }
    if (
      line.type === 'user' &&
      b.type === 'tool_result' &&
      b.tool_use_id &&
      running.delete(b.tool_use_id)
    )
      out.push({ kind: 'agent-end', id: b.tool_use_id });
  }
  return out;
}
