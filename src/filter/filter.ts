import { plainRule, splitRules, type AgentEvent, type Denial } from '@/agents';
import type { ThreadEntry } from '@/shared';
import { splitChoices } from './choices';

const YES_NO = /\(\s*y\s*\/\s*n\s*\)/i;

// The one rule for what you see: words for you are shown, the agent's tool work is hidden.
export function toEntries(event: AgentEvent, at: string): ThreadEntry[] {
  const entry = (kind: ThreadEntry['kind'], text: string, shown = true): ThreadEntry => ({
    at,
    kind,
    text,
    shown,
    source: 'chat',
  });
  switch (event.kind) {
    case 'session':
      return [];
    case 'text':
      return [textEntry(event.text, at)];
    case 'tool':
      return [entry('tool', `${event.name} — ${event.summary}`, false)];
    case 'tool-result':
      return [entry('tool-result', `${event.isError ? 'error: ' : ''}${event.text}`, false)];
    case 'done': {
      const failed = event.isError && event.error ? [entry('error', event.error)] : [];
      const around = (event.workedAround ?? []).map((d) =>
        entry('tool', `Refused, then found another way — ${d.tool}: ${d.summary}`, false),
      );
      return [...around, ...approvalFor(event.denied, at), ...failed];
    }
    case 'agent-start':
    case 'agent-step':
    case 'agent-end':
    case 'limits':
    case 'tokens':
      return [];
    case 'compacted':
      return [
        entry(
          'progress',
          'The agent was full and squeezed its own memory. Some detail may be lost.',
        ),
      ];
  }
}

function textEntry(raw: string, at: string): ThreadEntry {
  const { body: text, choices } = splitChoices(raw);
  const base = { at, text, shown: true, source: 'chat' as const };
  if (choices.length > 0) {
    const actions = choices.map((c) => ({ kind: 'reply' as const, label: c, value: c }));
    return { ...base, kind: 'question', actions };
  }
  if (YES_NO.test(text)) {
    return {
      ...base,
      kind: 'approval',
      actions: [
        { kind: 'reply', label: 'Yes', value: 'yes' },
        { kind: 'reply', label: 'No', value: 'no' },
      ],
    };
  }
  return { ...base, kind: text.trim().endsWith('?') ? 'question' : 'agent' };
}

const SAY_NO = 'No, I did not allow that. Find another way, or tell me what you need it for.';

// A numbered item; its later lines (a code box) are indented so they stay inside the item.
const listItem = (n: number, text: string) => {
  const marker = `${n}. `;
  return marker + text.split('\n').join(`\n${' '.repeat(marker.length)}`);
};

// Everything one answer was refused, as one card and one decision.
export function approvalFor(denied: Denial[], at: string): ThreadEntry[] {
  if (denied.length === 0) return [];
  const rules = [...new Set(denied.flatMap((d) => splitRules(d.allow)))];
  const things = denied.length === 1 ? '1 thing' : `${denied.length} things`;
  const text = [
    `**Claude needs your OK for ${things}:**`,
    '',
    ...denied.map((d, i) => listItem(i + 1, d.wants)),
    '',
    `Allows in this chat: ${rules.map(plainRule).join(' · ')}`,
  ].join('\n');
  return [
    {
      at,
      kind: 'approval',
      text,
      shown: true,
      source: 'chat',
      actions: [
        { kind: 'allow', label: 'Allow and retry', value: rules.join(',') },
        { kind: 'reply', label: 'No', value: SAY_NO },
      ],
    },
  ];
}
