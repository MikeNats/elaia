// The line Claude ends a question with when the answer is a pick: it becomes buttons.
export const CHOICES_PREFIX = 'Choices:';
const MAX_CHOICES = 6;

const isChoicesLine = (line: string) =>
  line.replace(/\*\*/g, '').trim().toLowerCase().startsWith(CHOICES_PREFIX.toLowerCase());

// The last Choices line wins. Anything after it is dropped: the rule says the message ends there,
// and text after it is the model running on, not something for you.
export function splitChoices(text: string): { body: string; choices: string[] } {
  const lines = text.trimEnd().split('\n');
  const at = lines.findLastIndex(isChoicesLine);
  if (at === -1) return { body: text, choices: [] };
  const choices = (lines[at] ?? '')
    .replace(/\*\*/g, '')
    .trim()
    .slice(CHOICES_PREFIX.length)
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, MAX_CHOICES);
  if (choices.length < 2) return { body: text, choices: [] };
  return { body: lines.slice(0, at).join('\n').trimEnd(), choices };
}
