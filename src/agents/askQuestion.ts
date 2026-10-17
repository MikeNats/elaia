import { z } from 'zod';
import type { AgentEvent } from './types';

// The input of Claude Code's pop-up question tool, which cannot open inside Elaia.
const AskInput = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      options: z.array(z.object({ label: z.string() })).optional(),
    }),
  ),
});

export const ASK_TOOL = 'AskUserQuestion';

// If Claude still tried the pop-up, its question is not lost: it becomes a text question
// with a Choices line, which Elaia shows as buttons. The same question asked twice shows once.
export function askedQuestions(inputs: unknown[]): AgentEvent[] {
  const texts = inputs.flatMap((input) => {
    const parsed = AskInput.safeParse(input);
    if (!parsed.success) return [];
    return parsed.data.questions.map((q) => {
      const labels = (q.options ?? []).map((o) => o.label.replace(/\|/g, '/'));
      return labels.length >= 2 ? `${q.question}\n\nChoices: ${labels.join(' | ')}` : q.question;
    });
  });
  return [...new Set(texts)].map((text): AgentEvent => ({ kind: 'text', text }));
}
