import path from 'node:path';
import type { Runnable } from '@/shared';
import { UNREADABLE } from './repoTrust';

// One line, whatever it holds: a newline from the repo must not end the list item.
const oneLine = (s: string) => s.replace(/\r?\n|\r/g, ' ↵ ');

// An invisible word joiner. GFM turns a bare URL, www. name or email into a link even after a
// backslash, so one of these goes inside each.
const WJ = '\u2060';

// A name the repo picks, as plain text on one line. The card is the only place you consent, so
// the repo must not make it show a heading, a link, bold text or a new list item.
const plain = (s: string) =>
  oneLine(s)
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\\`*_[\]{}<>#~|!]/g, '\\$&')
    .replace(/^([-+=])/, '\\$1')
    .replace(/^(\d+)([.)])/, '$1\\$2')
    .replace(/(www)\./gi, `$1${WJ}.`)
    .replace(/:\//g, `:${WJ}/`)
    .replace(/@/g, `${WJ}@`);

// In code font, on one line. The fence is longer than any backtick run inside (CommonMark), so
// the command shows exactly as written.
const code = (run: string) => {
  const one = oneLine(run);
  const longest = Math.max(0, ...(one.match(/`+/g) ?? []).map((r) => r.length));
  if (longest === 0) return `\`${one}\``;
  const fence = '`'.repeat(longest + 1);
  return `${fence} ${one} ${fence}`;
};
const line = (r: Runnable) =>
  r.what === UNREADABLE ? `- ${r.what}` : `- ${plain(r.what)}: ${code(r.run)}`;

// What this repo can make run, by file.
export function trustCardText(project: string, items: Runnable[]): string {
  const files = [...new Set(items.map((i) => i.file))];
  const groups = files.flatMap((file) => [
    '',
    file,
    ...items.filter((i) => i.file === file).map(line),
  ]);
  return [
    `**Trust ${plain(path.basename(project))}?**`,
    '',
    'This repo can make these run on your computer:',
    ...groups,
    '',
    'Press Trust only if you trust where this repo came from.',
  ].join('\n');
}
