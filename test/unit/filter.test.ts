import { describe, expect, it } from 'vitest';
import { toEntries } from '@/filter';

const at = '2026-10-13T10:00:00Z';

describe('filter', () => {
  it('shows agent text', () => {
    expect(toEntries({ kind: 'text', text: 'Done.' }, at)).toEqual([
      { at, kind: 'agent', text: 'Done.', shown: true, source: 'chat' },
    ]);
  });

  it('marks a question', () => {
    expect(toEntries({ kind: 'text', text: 'Which table should it use?' }, at)[0]?.kind).toBe(
      'question',
    );
  });

  it('turns a y/n prompt into an approval with buttons', () => {
    const [entry] = toEntries({ kind: 'text', text: 'Start the coder on this plan? (y/n)' }, at);
    expect(entry).toMatchObject({ kind: 'approval', shown: true });
    expect(entry?.actions).toEqual([
      { kind: 'reply', label: 'Yes', value: 'yes' },
      { kind: 'reply', label: 'No', value: 'no' },
    ]);
  });

  it('hides tool calls and their results behind details', () => {
    const tool = toEntries({ kind: 'tool', name: 'Read', summary: 'a.ts' }, at);
    const result = toEntries({ kind: 'tool-result', isError: false, text: 'ok' }, at);
    expect([...tool, ...result].map((e) => e.shown)).toEqual([false, false]);
    expect(tool[0]?.text).toBe('Read — a.ts');
  });

  it('drops session events', () => {
    expect(toEntries({ kind: 'session', sessionId: 's' }, at)).toEqual([]);
  });

  it('puts everything that was refused into one plain-words card', () => {
    const [card] = toEntries(
      {
        kind: 'done',
        sessionId: 's',
        isError: false,
        tokens: null,
        error: null,
        denied: [
          { tool: 'Skill', summary: 'x', wants: 'Use the skill **glafka:lysis**', allow: 'Skill' },
          { tool: 'Bash', summary: 'x', wants: 'Run a command: `npm test`', allow: 'Bash(npm:*)' },
        ],
      },
      at,
    );
    expect(card).toMatchObject({ kind: 'approval', shown: true, source: 'chat' });
    expect(card?.text).toContain('Claude needs your OK for 2 things');
    expect(card?.text).toContain('1. Use the skill **glafka:lysis**');
    expect(card?.text).toContain('Allows in this chat: skills · `npm`');
    expect(card?.actions?.[0]).toEqual({
      kind: 'allow',
      label: 'Allow and retry',
      value: 'Skill,Bash(npm:*)',
    });
    expect(card?.actions?.[1]).toMatchObject({ kind: 'reply', label: 'No' });
  });

  it('shows an exact rule with a comma as one rule', () => {
    const rule = 'Bash(sh -c "echo a, b")';
    const [card] = toEntries(
      {
        kind: 'done',
        sessionId: 's',
        isError: false,
        tokens: null,
        error: null,
        denied: [{ tool: 'Bash', summary: 'x', wants: 'Run a command', allow: rule }],
      },
      at,
    );
    expect(card?.text).toContain('Allows in this chat: only `sh -c "echo a, b"`');
    expect(card?.actions?.[0]).toEqual({ kind: 'allow', label: 'Allow and retry', value: rule });
  });

  it('shows a failed turn as an error', () => {
    const entries = toEntries(
      { kind: 'done', sessionId: null, isError: true, tokens: null, denied: [], error: 'boom' },
      at,
    );
    expect(entries).toEqual([{ at, kind: 'error', text: 'boom', shown: true, source: 'chat' }]);
  });
});
