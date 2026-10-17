import { describe, expect, it } from 'vitest';
import { commandAdapter } from '@/agents';

describe('command adapter', () => {
  it('runs the shell command with the prompt on stdin', () => {
    const adapter = commandAdapter({ command: 'gemini -p', prompt: 'hello' });
    expect(adapter.command).toBe('sh');
    expect(adapter.args).toEqual(['-c', 'gemini -p']);
    expect(adapter.input).toBe('hello');
  });

  it('turns all output into one answer at the end', () => {
    const adapter = commandAdapter({ command: 'x', prompt: 'p' });
    expect(adapter.parseLine('line one')).toEqual([]);
    expect(adapter.parseLine('line two')).toEqual([]);
    expect(adapter.finish(0, '')).toEqual([
      { kind: 'text', text: 'line one\nline two' },
      { kind: 'done', sessionId: null, isError: false, tokens: null, denied: [], error: null },
    ]);
  });

  it('reports a failed command with its stderr', () => {
    const [done] = commandAdapter({ command: 'x', prompt: 'p' }).finish(2, 'not found');
    expect(done).toMatchObject({
      kind: 'done',
      isError: true,
      error: expect.stringContaining('not found'),
    });
  });
});
