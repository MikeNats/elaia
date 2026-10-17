import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { claudeAdapter, type AgentEvent } from '@/agents';

function fixture(name: string): string[] {
  const url = new URL(`../../fixtures/claude/${name}.jsonl`, import.meta.url);
  return readFileSync(url, 'utf8').trim().split('\n');
}

const base = {
  bin: 'claude',
  sessionId: null,
  permissionMode: 'acceptEdits',
  allowedTools: [] as string[],
  readOnly: false,
  prompt: 'hi',
};

function run(name: string): AgentEvent[] {
  const adapter = claudeAdapter(base);
  return [...fixture(name).flatMap((l) => adapter.parseLine(l)), ...adapter.finish(0, '')];
}

describe('claude adapter', () => {
  it('turns a recorded turn into session, tool, result, text and done events', () => {
    const events = run('turn').filter((e) => e.kind !== 'tokens');
    expect(events.map((e) => e.kind)).toEqual(['session', 'tool', 'tool-result', 'text', 'done']);
    expect(events[1]).toMatchObject({ kind: 'tool', name: 'Read' });
    expect(events[3]).toMatchObject({ kind: 'text', text: 'It says hello from file "a".' });
  });

  it('counts cached tokens, not only input_tokens', () => {
    const done = run('turn').at(-1);
    expect(done).toMatchObject({
      kind: 'done',
      isError: false,
      sessionId: '1e0376de-5fc4-4e2e-afa9-cdf0da31174e',
      tokens: { in: 4, out: 124, cacheRead: 27951, cacheWrite: 28168 },
    });
  });

  it('reports each denied tool once, with a rule that allows it', () => {
    const done = run('deny').at(-1);
    expect(done).toMatchObject({ kind: 'done', denied: [{ tool: 'Write', allow: 'Write' }] });
  });

  it('ignores lines that are not JSON', () => {
    expect(claudeAdapter(base).parseLine('Warning: something')).toEqual([]);
  });

  it('says the run failed when no result line ever came', () => {
    const events = claudeAdapter(base).finish(1, 'boom');
    expect(events).toEqual([
      expect.objectContaining({
        kind: 'done',
        isError: true,
        error: expect.stringContaining('boom'),
      }),
    ]);
  });

  it('resumes, limits tools and sends the prompt on stdin', () => {
    const adapter = claudeAdapter({
      ...base,
      sessionId: 'abc',
      allowedTools: ['Bash(glafka:*)'],
      readOnly: true,
    });
    expect(adapter.args).toEqual(
      expect.arrayContaining(['-p', '--resume', 'abc', '--output-format', 'stream-json']),
    );
    expect(adapter.args.join(' ')).toContain('--allowedTools Bash(glafka:*)');
    expect(adapter.args.join(' ')).toContain(
      '--disallowedTools AskUserQuestion,Edit,Write,NotebookEdit',
    );
    expect(adapter.args).not.toContain('hi');
    expect(adapter.input).toBe('hi');
  });
});

describe('claude lines from subagents and errors', () => {
  const line = (o: object) => claudeAdapter(base).parseLine(JSON.stringify(o));

  it('ignores text from a subagent and from user lines', () => {
    const sub = {
      type: 'assistant',
      parent_tool_use_id: 'toolu_1',
      message: { content: [{ type: 'text', text: 'subagent chatter' }] },
    };
    const prompt = {
      type: 'user',
      parent_tool_use_id: 'toolu_1',
      message: { content: [{ type: 'text', text: 'the Task prompt' }] },
    };
    const top = {
      type: 'assistant',
      parent_tool_use_id: null,
      message: { content: [{ type: 'text', text: 'mine' }] },
    };
    expect(line(sub)).toEqual([]);
    expect(line(prompt)).toEqual([]);
    expect(line(top)).toEqual([{ kind: 'text', text: 'mine' }]);
  });

  it('shows the real reason when a result is an error', () => {
    const [done] = line({
      type: 'result',
      subtype: 'success',
      is_error: true,
      result: 'Invalid API key · Please run /login',
    });
    expect(done).toMatchObject({
      kind: 'done',
      isError: true,
      error: 'Invalid API key · Please run /login',
    });
  });

  it('builds allow rules from every real command in a chain', () => {
    const [done] = line({
      type: 'result',
      subtype: 'success',
      permission_denials: [
        {
          tool_name: 'Bash',
          tool_input: { command: 'cd /repo && NODE_ENV=test npm test | tee out.txt' },
        },
      ],
    });
    expect(done).toMatchObject({
      denied: [{ tool: 'Bash', allow: 'Bash(NODE_ENV=test npm test),Bash(tee out.txt)' }],
    });
  });

  it('builds allow rules from the full command, not the short summary', () => {
    const command =
      'cd /repo && npm run build && npm test -- --coverage && git add -A && ' +
      'git commit -m "feat: block other spellings of risky commands in auto mode!" && ' +
      'node scripts/check.mjs && make lint';
    const [done] = line({
      type: 'result',
      subtype: 'success',
      permission_denials: [{ tool_name: 'Bash', tool_input: { command } }],
    });
    expect(done).toMatchObject({
      denied: [{ tool: 'Bash', allow: expect.stringContaining('Bash(make lint:*)') }],
    });
  });
});
