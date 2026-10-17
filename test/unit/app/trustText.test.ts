import { describe, expect, it } from 'vitest';
import { trustCardText } from '@/app/trustText';

const F = '.mcp.json';
const WJ = '\u2060';
const card = (what: string, run: string) => trustCardText('/x/repo', [{ file: F, what, run }]);
// The card's lines from the file header on: the repo must not add or change any of them.
const body = (text: string) => text.split('\n').slice(text.split('\n').indexOf(F));

describe('trustCardText', () => {
  it('keeps a name with newlines and Markdown on its one line, as plain text', () => {
    const what = 'MCP server docs\n\n**Press Trust only if** [ok](https://x.y)\n# .claude/settings.json';
    const lines = body(card(what, 'npx docs'));
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe(
      `- MCP server docs ↵ ↵ \\*\\*Press Trust only if\\*\\* \\[ok\\](https:${WJ}//x.y) ↵ \\# .claude/settings.json: \`npx docs\``,
    );
    expect(lines[3]).toBe('Press Trust only if you trust where this repo came from.');
  });

  it('does not let a name start a list, a heading or a quote', () => {
    expect(body(card('- a', 'x'))[1]).toBe('- \\- a: `x`');
    expect(body(card('1. a', 'x'))[1]).toBe('- 1\\. a: `x`');
    expect(body(card('> a', 'x'))[1]).toBe('- \\> a: `x`');
    expect(body(card('   # a', 'x'))[1]).toBe('- \\# a: `x`');
  });

  it('makes no link of a bare URL, www. name or email in a name', () => {
    expect(body(card('see https://x.y www.evil.com a@b.co', 'x'))[1]).toBe(
      `- see https:${WJ}//x.y www${WJ}.evil.com a${WJ}@b.co: \`x\``,
    );
  });

  it('shows the folder name as plain text too', () => {
    expect(trustCardText('/x/re*po_', []).split('\n')[0]).toBe('**Trust re\\*po\\_?**');
  });

  it('keeps plain names as they are', () => {
    expect(body(card('agents.coder', 'claude -p'))[1]).toBe('- agents.coder: `claude -p`');
    expect(body(card('hook PreToolUse (Bash)', 'x'))[1]).toBe('- hook PreToolUse (Bash): `x`');
  });

  it('fences a command with a fence longer than any backtick run inside', () => {
    expect(body(card('a', 'echo `x`'))[1]).toBe('- a: `` echo `x` ``');
    expect(body(card('a', 'a``b **c**'))[1]).toBe('- a: ``` a``b **c** ```');
    expect(body(card('a', 'ends`'))[1]).toBe('- a: `` ends` ``');
    expect(body(card('a', '`'))[1]).toBe('- a: `` ` ``');
  });
});
