// The commands of a chain, split where Claude splits them: && || |& ; | & and new lines.
// Text in quotes, after a backslash, or in a redirect like 2>&1 stays whole.
export function splitCommands(command: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: string | null = null;
  const cut = () => {
    parts.push(current);
    current = '';
  };
  for (let i = 0; i < command.length; i++) {
    const c = command[i] as string;
    const next = command[i + 1] ?? '';
    if (quote !== null) {
      current += c;
      if (c === '\\' && quote === '"') {
        current += next;
        i++;
      } else if (c === quote) quote = null;
    } else if (c === '\\') {
      current += c + next;
      i++;
    } else if (c === "'" || c === '"') {
      quote = c;
      current += c;
    } else if (c === '&' && (/[<>]$/.test(current) || next === '>')) {
      current += c; // a redirect: 2>&1, >&2, &>file
    } else if ((c === '&' && next === '&') || (c === '|' && (next === '|' || next === '&'))) {
      cut();
      i++;
    } else if (c === ';' || c === '|' || c === '&' || c === '\n') {
      cut();
    } else {
      current += c;
    }
  }
  cut();
  return parts.map((part) => part.trim()).filter((part) => part !== '');
}

// Drops the wrappers Claude drops before it matches a rule: `timeout 30 npm test` is `npm test`.
export function unwrap(words: string[]): string[] {
  const [first, ...rest] = words;
  if (first === 'time' || first === 'nohup' || first === 'builtin' || first === 'noglob') {
    return unwrap(rest);
  }
  if (first === 'command' && !/^-[vV]$/.test(rest[0] ?? '')) return unwrap(rest);
  if (first === 'nice') return unwrap(dropOptions(rest, ['-n']));
  if (first === 'stdbuf') return unwrap(dropOptions(rest, ['-i', '-o', '-e']));
  if (first === 'timeout') {
    return unwrap(dropOptions(rest, ['-s', '-k', '--signal', '--kill-after']).slice(1));
  }
  return words;
}

// Drops leading options; the ones named take the next word as their value.
function dropOptions(words: string[], withValue: string[]): string[] {
  let i = 0;
  while (words[i]?.startsWith('-')) i += withValue.includes(words[i] as string) ? 2 : 1;
  return words.slice(i);
}
