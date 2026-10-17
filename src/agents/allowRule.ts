import { splitCommands, unwrap } from './commandParts';

// Programs that run other code: their rule allows only the exact command.
const RUNS_CODE = new Set(
  'sh bash zsh env xargs node python python3 npx sudo eval exec bunx deno ruby perl'.split(' '),
);
const RUNS_CODE_SUBCOMMANDS = new Set(['npm exec', 'pnpm dlx', 'yarn dlx']);
// A program by its plain name, and a subcommand word after it.
const PLAIN_PROGRAM = /^[A-Za-z0-9][\w.+-]*$/;
const PLAIN_WORD = /^[A-Za-z][\w:-]*$/;
const ASSIGNMENT = /^[A-Za-z_]\w*=/;

const commandOf = (input: unknown): string => {
  const command =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>).command : null;
  return typeof command === 'string' ? command.trim() : '';
};

// The rules that let this call through, built from the full command. Claude checks each
// command of a chain on its own, so `cd x && npm test` needs `Bash(npm test:*)`, not `Bash(cd:*)`.
export function allowRule(name: string, input: unknown): string {
  if (name !== 'Bash') return name;
  const command = commandOf(input);
  const rules = [...new Set(splitCommands(command).flatMap(ruleFor))];
  // Nothing left (only `cd`, say): the exact command, never `Bash`, which allows every command.
  return (rules.length > 0 ? rules : [`Bash(${command})`]).join(',');
}

// One command's rule: program and subcommand (`Bash(git commit:*)`, so `git push` stays out),
// the exact command, or none for `cd`. Past an unknown VAR=value Claude matches no wider rule.
function ruleFor(part: string): string[] {
  const exact = [`Bash(${part})`];
  const words = part.split(/\s+/);
  if (ASSIGNMENT.test(words[0] ?? '')) return exact;
  const [program, word] = unwrap(words);
  if (program === 'cd') return [];
  if (program === undefined || RUNS_CODE.has(program)) return exact;
  if (RUNS_CODE_SUBCOMMANDS.has(`${program} ${word}`)) return exact;
  return PLAIN_PROGRAM.test(program) && word !== undefined && PLAIN_WORD.test(word)
    ? [`Bash(${program} ${word}:*)`]
    : exact;
}

// Saved rules come joined by commas. A comma inside ( ), and a bracket inside quotes there,
// belong to their rule: `Bash(sh -c "echo a, b")` stays one rule.
export function splitRules(joined: string): string[] {
  const rules: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;
  for (const c of joined) {
    if (escaped) escaped = false;
    else if (c === '\\') escaped = true;
    else if (quote !== null) {
      if (c === quote) quote = null;
    } else if (c === ',' && depth === 0) {
      rules.push(current);
      current = '';
      continue;
    } else if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
    else if ((c === '"' || c === "'") && depth > 0) quote = c;
    current += c;
  }
  rules.push(current);
  return rules.filter((rule) => rule !== '');
}
