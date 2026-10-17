import path from 'node:path';
import type { Denial } from './types';

const RULE = /^(\w+)\((.+)\)$/;

// One command of a chain covered by a `Bash(prefix:*)` rule, the way Claude checks each part.
const commandCovered = (command: string, prefix: string) =>
  command.split(/&&|\|\||;|\|/).some((part) => part.trim().startsWith(prefix));

// One command of a chain matching a `Bash(git -C * worktree remove *)` rule: `*` is any text.
const escape = (text: string) => text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
const globCovered = (command: string, glob: string) => {
  const re = new RegExp(`^${glob.split('*').map(escape).join('.*')}$`);
  return command.split(/&&|\|\||;|\|/).some((part) => re.test(part.trim()));
};

// A path inside a folder rule like `Edit(.worktrees/**)`.
const pathCovered = (file: string, dir: string) =>
  file.startsWith(`${dir}/`) || file.includes(`${path.sep}${dir}${path.sep}`);

// `//abs/path` in a rule is an absolute path; a plain one is relative and may sit at any depth.
const fromRule = (spec: string) => (spec.startsWith('//') ? spec.slice(1) : spec);
const fileCovered = (file: string, rule: string) => file === rule || file.endsWith(`/${rule}`);

// A refusal that a deny rule caused on purpose (`Bash(glafka create:*)`, `Edit(.worktrees/**)`).
// An Allow button could never undo it, so none is offered.
export function blockedOnPurpose(denial: Denial, rules: readonly string[]): boolean {
  return rules.some((rule) => {
    const match = RULE.exec(rule);
    if (!match) return rule === denial.tool;
    const [, tool, spec = ''] = match;
    if (tool !== denial.tool) return false;
    const target = denial.target ?? denial.summary;
    if (spec.endsWith(':*')) return commandCovered(target, spec.slice(0, -2));
    if (spec.endsWith('/**')) return pathCovered(target, fromRule(spec).slice(0, -3));
    if (tool === 'Bash' && spec.includes('*')) return globCovered(target, spec);
    return fileCovered(target, fromRule(spec));
  });
}
