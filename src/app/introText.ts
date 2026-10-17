// A ticket's brief, made easy to read: one sentence per line, the "Done when" checks as their
// own list, and code names in code font.

// Paths, file names, name() calls, camelCase and snake_case names, --flags.
const CODE =
  /(`[^`]*`)|((?:[\w.-]+\/)+[\w.-]+|\b[\w-]+\.(?:json|tsx?|jsx?|mjs|cjs|md|ya?ml)\b|\b\w+\(\)|\b[a-z]+[A-Z]\w*\b|\b[a-z]+_[a-z_]+\b|(?<!\w)--[\w-]+)/g;

// Paths, calls and flags in code font; text already in backticks is left alone.
const codeFont = (text: string) =>
  text.replace(CODE, (whole, quoted: string | undefined) => (quoted ? whole : `\`${whole}\``));

// Sentences: a full stop, then a space and a capital letter or a backtick.
const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+(?=[A-Z`(])/)
    .map((s) => s.trim())
    .filter(Boolean);

export function briefMarkdown(brief: string): string[] {
  const [todo = '', done = ''] = brief.split(/\s*Done when:\s*/i);
  const lines = sentences(todo).map((s) => `- ${codeFont(s)}`);
  const checks = done
    .split(/;\s*|\.\s+(?=[A-Za-z])/)
    .map((s) => s.trim().replace(/\.$/, ''))
    .filter(Boolean);
  if (checks.length === 0) return lines;
  return [...lines, '', '**Done when**', '', ...checks.map((c) => `- ${codeFont(c)}`)];
}
