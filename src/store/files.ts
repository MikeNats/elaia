import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';

// A missing or corrupt file reads as the fallback. Everything here can be rebuilt or lost safely.
export function readJson<T>(file: string, schema: z.ZodType<T>, fallback: T): T {
  if (!existsSync(file)) return fallback;
  try {
    const parsed = schema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

// Write to a temp file, then rename, so a crash never leaves half a file.
export function writeJson(file: string, data: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(data, null, 2)}\n`);
  renameSync(temp, file);
}

export function appendLines(file: string, lines: string[]): void {
  if (lines.length === 0) return;
  mkdirSync(path.dirname(file), { recursive: true });
  appendFileSync(file, lines.map((l) => `${l}\n`).join(''));
}

// Lines that fail the schema are skipped, so one bad line never loses a thread.
export function readLines<T>(file: string, schema: z.ZodType<T>): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .flatMap((line) => {
      try {
        const parsed = schema.safeParse(JSON.parse(line));
        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    });
}
