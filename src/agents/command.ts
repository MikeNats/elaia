import type { AgentAdapter } from './types';
import { failed } from './types';

// Any agent CLI that reads a prompt on stdin and prints an answer — the same
// contract glafka uses for its own agents. No sessions, so the caller replays context.
export function commandAdapter({
  command,
  prompt,
}: {
  command: string;
  prompt: string;
}): AgentAdapter {
  const lines: string[] = [];
  return {
    command: 'sh',
    args: ['-c', command],
    input: prompt,
    parseLine(line) {
      lines.push(line);
      return [];
    },
    finish(exitCode, stderr) {
      const text = lines.join('\n').trim();
      if (exitCode !== 0)
        return [
          ...(text ? [{ kind: 'text' as const, text }] : []),
          failed(exitCode, stderr, command),
        ];
      return [
        { kind: 'text', text: text || '(no output)' },
        { kind: 'done', sessionId: null, isError: false, tokens: null, denied: [], error: null },
      ];
    },
  };
}
