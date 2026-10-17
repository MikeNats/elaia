export { describeRequest, plainRule } from './request';

// One short line that says what a tool call did, for "show details".
export function summarizeInput(name: string, input: unknown): string {
  const fields =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const pick = (key: string) => (typeof fields[key] === 'string' ? (fields[key] as string) : null);
  const main =
    pick('command') ?? pick('file_path') ?? pick('pattern') ?? pick('url') ?? pick('description');
  return clip(main ?? JSON.stringify(input) ?? name, 160);
}

// The rule that would let this call through. Claude checks each command of a chain on its
// own, so `cd x && npm test` needs `Bash(npm:*)`, not `Bash(cd:*)`.
export function allowRule(name: string, input: unknown): string {
  if (name !== 'Bash') return name;
  const words = summarizeInput(name, input)
    .split(/&&|\|\||;|\|/)
    .map((part) => firstCommand(part))
    .filter((word): word is string => word !== null);
  const unique = [...new Set(words)];
  return unique.length === 0 ? 'Bash' : unique.map((w) => `Bash(${w}:*)`).join(',');
}

// The command word of one part, past `VAR=value` prefixes. `cd` never needs a rule.
function firstCommand(part: string): string | null {
  const word = part
    .trim()
    .split(/\s+/)
    .find((w) => w !== '' && !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
  return word && word !== 'cd' ? word : null;
}

export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}
