// Tool requests in plain words: for the person who has to say yes or no.
const field = (input: unknown, key: string): string | null => {
  const value =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>)[key] : null;
  return typeof value === 'string' ? value : null;
};

// One line, no backticks inside, so it can sit in inline code.
const line = (text: string, max = 90) => {
  const flat = text.replace(/\s+/g, ' ').replace(/`/g, "'").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

const FILE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);
const WEB_TOOLS = new Set(['WebFetch', 'WebSearch']);

// A command in its own code box, one step per line: a new line at each | && || ;
const commandBox = (command: string, max = 600) => {
  const short = command.length > max ? `${command.slice(0, max - 1)}…` : command;
  const steps = short
    .trim()
    .replace(/```/g, "'''")
    .replace(/\s+(\|\||&&|\|)\s+/g, '\n$1 ')
    .replace(/;\s+/g, ';\n');
  return ['```sh', steps, '```'].join('\n');
};

export function describeRequest(tool: string, input: unknown): string {
  if (tool === 'Bash') return `Run a command:\n${commandBox(field(input, 'command') ?? '')}`;
  if (tool === 'Skill') return `Use the skill **${field(input, 'skill') ?? 'unknown'}**`;
  if (FILE_TOOLS.has(tool)) return `Change a file: \`${line(field(input, 'file_path') ?? '')}\``;
  if (WEB_TOOLS.has(tool)) {
    return `Look on the web: \`${line(field(input, 'url') ?? field(input, 'query') ?? '')}\``;
  }
  return `Use the tool **${tool}**`;
}

// What an allow rule lets through, in a word or two.
export function plainRule(rule: string): string {
  if (rule === 'Skill') return 'skills';
  if (rule === 'Bash') return 'any command';
  if (FILE_TOOLS.has(rule)) return 'file changes';
  const command = rule.match(/^Bash\((.+):\*\)$/s)?.[1];
  if (command) return `\`${command}\``;
  // A rule with no `:*` allows that one command and nothing more, unless it holds a `*`:
  // Claude reads every `*` as any text, so `rm *.log` also allows `rm -rf ~ x.log`.
  const exact = rule.match(/^Bash\((.+)\)$/s)?.[1];
  if (!exact) return rule;
  return exact.includes('*')
    ? `\`${line(exact)}\`, where * can be any text`
    : `only \`${line(exact)}\``;
}
