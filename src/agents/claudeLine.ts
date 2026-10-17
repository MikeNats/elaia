import type { AgentEvent, Denial } from './types';
import { askedQuestions, ASK_TOOL } from './askQuestion';
import { limitsOf } from './claudeLimits';
import { Line } from './claudeShape';
import { allowRule } from './allowRule';
import { clip, describeRequest, summarizeInput } from './summary';

export function readLine(raw: string): Line | null {
  if (!raw.trim().startsWith('{')) return null;
  try {
    const line = Line.safeParse(JSON.parse(raw));
    return line.success ? line.data : null;
  } catch {
    return null;
  }
}

export function parseClaudeLine(raw: string): AgentEvent[] {
  const line = readLine(raw);
  return line ? eventsOf(line) : [];
}

export function eventsOf(line: Line): AgentEvent[] {
  if (line.type === 'system' && line.subtype === 'init' && line.session_id) {
    return [{ kind: 'session', sessionId: line.session_id }];
  }
  if (line.type === 'system' && line.subtype === 'compact_boundary') return [{ kind: 'compacted' }];
  if (line.type === 'rate_limit_event') return limitsOf(line);
  if (line.type === 'result') {
    const all = line.permission_denials ?? [];
    const asked = all.filter((d) => d.tool_name === ASK_TOOL).map((d) => d.tool_input);
    const rest = { ...line, permission_denials: all.filter((d) => d.tool_name !== ASK_TOOL) };
    return [...askedQuestions(asked), resultEvent(rest)];
  }
  // Only the main agent's own work. A subagent's lines and its Task prompt are not words for you.
  if (line.parent_tool_use_id) return [];
  const content = line.message?.content;
  if (!Array.isArray(content)) return [];
  const spoken = line.type === 'assistant';
  return content.flatMap((block): AgentEvent[] => {
    if (block.type === 'text' && spoken && block.text?.trim()) {
      return [{ kind: 'text', text: block.text }];
    }
    if (block.type === 'tool_use' && block.name) {
      return [{ kind: 'tool', name: block.name, summary: summarizeInput(block.name, block.input) }];
    }
    if (block.type === 'tool_result') {
      return [
        { kind: 'tool-result', isError: block.is_error ?? false, text: resultText(block.content) },
      ];
    }
    return [];
  });
}

function resultEvent(line: Line): AgentEvent {
  const usage = line.usage ?? {};
  const num = (key: string) => (typeof usage[key] === 'number' ? (usage[key] as number) : 0);
  const isError = line.is_error === true || line.subtype !== 'success';
  return {
    kind: 'done',
    sessionId: line.session_id ?? null,
    isError,
    tokens: {
      in: num('input_tokens'),
      out: num('output_tokens'),
      cacheRead: num('cache_read_input_tokens'),
      cacheWrite: num('cache_creation_input_tokens'),
      costUsd: line.total_cost_usd ?? 0,
    },
    denied: denials(line),
    // An error result carries its reason in `result` (a login or API failure, say).
    error: isError
      ? line.result?.trim() || `the turn ended with ${line.subtype ?? 'an error'}`
      : null,
  };
}

// The same refusal repeats when the agent retries. Show each request once.
function denials(line: Line): Denial[] {
  const seen = new Map<string, Denial>();
  for (const d of line.permission_denials ?? []) {
    const wants = describeRequest(d.tool_name, d.tool_input);
    if (seen.has(wants)) continue;
    const summary = summarizeInput(d.tool_name, d.tool_input);
    seen.set(wants, {
      target: targetOf(d.tool_input),
      tool: d.tool_name,
      summary,
      wants,
      allow: allowRule(d.tool_name, d.tool_input),
    });
  }
  return [...seen.values()];
}

function targetOf(input: unknown): string {
  const fields =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const main = fields.command ?? fields.file_path ?? fields.notebook_path;
  return typeof main === 'string' ? main : '';
}

function resultText(content: unknown): string {
  if (typeof content === 'string') return clip(content, 300);
  if (!Array.isArray(content)) return '';
  const texts = content.map((c) => (c && typeof c.text === 'string' ? c.text : ''));
  return clip(texts.join(' '), 300);
}
