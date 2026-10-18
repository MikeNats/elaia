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

export function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}
