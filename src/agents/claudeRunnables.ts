import type { Runnable } from '@/shared';

// The files Claude Code reads from a project on its own, even with `claude -p`.
export const CLAUDE_TRUST_FILES = [
  '.claude/settings.json',
  '.claude/settings.local.json',
  '.mcp.json',
];

// Settings that name a program Claude starts by itself (a login helper, say).
const HELPERS = ['apiKeyHelper', 'awsAuthRefresh', 'awsCredentialExport', 'otelHeadersHelper'];

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
const str = (o: unknown, key: string) =>
  isObject(o) && typeof o[key] === 'string' ? o[key] : null;

// { Event: [{ matcher, hooks: [{ command }] }] }. Any other shape is listed as written.
function hooks(file: string, all: unknown): Runnable[] {
  if (!isObject(all)) return [{ file, what: 'hooks', run: text(all) }];
  return Object.entries(all).flatMap(([event, groups]) =>
    (Array.isArray(groups) ? groups : [groups]).flatMap((group: unknown) => {
      const inner = isObject(group) && Array.isArray(group.hooks) ? group.hooks : [group];
      const matcher = str(group, 'matcher');
      const what = `hook ${event}${matcher ? ` (${matcher})` : ''}`;
      return inner.map((h: unknown) => ({
        file,
        what,
        run: str(h, 'command') ?? str(h, 'url') ?? text(h),
      }));
    }),
  );
}

function servers(file: string, all: unknown): Runnable[] {
  if (!isObject(all)) return [{ file, what: 'MCP servers', run: text(all) }];
  return Object.entries(all).map(([name, s]) => {
    const command = str(s, 'command');
    const args = isObject(s) && Array.isArray(s.args) ? s.args.map(text) : [];
    const run = command ? [command, ...args].join(' ') : (str(s, 'url') ?? text(s));
    return { file, what: `MCP server ${name}`, run };
  });
}

function plugins(file: string, value: unknown): Runnable[] {
  const names = Array.isArray(value)
    ? value.map(text)
    : isObject(value)
      ? Object.entries(value)
          .filter(([, on]) => on !== false)
          .map(([name]) => name)
      : [text(value)];
  return names.map((run) => ({ file, what: 'plugin', run }));
}

// What Claude Code can run from one of its files, as written there. Pure: no disk.
export function claudeRunnables(file: string, json: unknown): Runnable[] {
  if (!isObject(json)) return [];
  return Object.entries(json).flatMap(([key, value]): Runnable[] => {
    if (key === 'hooks') return hooks(file, value);
    if (key === 'mcpServers') return servers(file, value);
    if (key === 'enabledPlugins') return plugins(file, value);
    if (key === 'env' && isObject(value))
      return Object.entries(value).map(([name, v]) => ({
        file,
        what: 'env',
        run: `${name}=${text(v)}`,
      }));
    if (key === 'extraKnownMarketplaces' && isObject(value))
      return Object.entries(value).map(([name, m]) => ({
        file,
        what: `marketplace ${name}`,
        run: text(isObject(m) && m.source !== undefined ? m.source : m),
      }));
    if (HELPERS.includes(key) || key.endsWith('Helper'))
      return [{ file, what: key, run: text(value) }];
    const command = str(value, 'command');
    return command ? [{ file, what: key, run: command }] : [];
  });
}
