import { SettingsSchema, type Settings } from './types';

// Settings a repo's own .vscode/settings.json may set. Every other one names a program,
// a command or a permission, so Elaia reads only your User value for it.
export const REPO_SETTINGS: ReadonlySet<string> = new Set<keyof Settings>([
  'platform',
  'handoffAt',
]);

// The part of a VS Code configuration that settingsFrom reads. Tests pass a fake.
export interface ConfigSource {
  get(key: string): unknown;
  inspect(key: string): { defaultValue?: unknown; globalValue?: unknown } | undefined;
}

// Your User value for a setting, or its default. A repo's own value never counts.
function userValue(c: ConfigSource, key: string): unknown {
  const seen = c.inspect(key);
  return seen?.globalValue ?? seen?.defaultValue;
}

// Reads Elaia's settings. A wrong value throws with the setting's name, so you know what to fix.
export function settingsFrom(c: ConfigSource): Settings {
  const raw = Object.fromEntries(
    Object.keys(SettingsSchema.shape).map((key) => [
      key,
      REPO_SETTINGS.has(key) ? c.get(key) : userValue(c, key),
    ]),
  );
  const parsed = SettingsSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const where = parsed.error.issues
    .map((i) => `elaia.${i.path.join('.')}: ${i.message}`)
    .join('; ');
  throw new Error(
    `Elaia settings are not valid — ${where}. Fix them in Settings, then reload the window.`,
  );
}
