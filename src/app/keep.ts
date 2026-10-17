import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { upgradeOldCard } from '@/filter';
import { chatFile, prepareElaiaDir } from '@/memory';
import { threadKey, ThreadEntrySchema, type ThreadEntry, type ThreadRef } from '@/shared';
import type { AppState } from './types';

const QUIET_MS = 1500;

// What the repo file already holds: on a new machine or clone, the older part of the chat.
function inRepo(file: string): ThreadEntry[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line) => {
      try {
        const parsed = ThreadEntrySchema.safeParse(JSON.parse(line));
        return parsed.success ? [parsed.data] : [];
      } catch {
        return [];
      }
    });
}

// Writes the shown chat into the repo's .elaia/chats/ (ignored by git), so agents can read it.
// Entries older than this machine's copy are kept, so a reset store never wipes them.
export function keepNow(app: AppState, ref: ThreadRef): string | null {
  try {
    const file = chatFile(ref.project, ref.thread);
    const shown = app.deps.store.threads
      .read(ref)
      .filter((e) => e.shown)
      .map(upgradeOldCard);
    if (shown.length === 0) return null;
    // Before the repo file is read too: a symlink there could point anywhere.
    prepareElaiaDir(ref.project, path.dirname(file));
    const older = inRepo(file).filter((e) => e.at < shown[0]!.at);
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, [...older, ...shown].map((e) => `${JSON.stringify(e)}\n`).join(''));
    renameSync(temp, file);
    return file;
  } catch {
    // A deleted, moved or read-only repo, or a symlink in .elaia. This machine's copy still has it.
    return null;
  }
}

// The same, once the chat is quiet for a moment: a turn writes many lines.
export function keepSoon(app: AppState, ref: ThreadRef): void {
  const key = threadKey(ref);
  clearTimeout(app.keeping.get(key)?.timer);
  const timer = setTimeout(() => {
    app.keeping.delete(key);
    keepNow(app, ref);
  }, QUIET_MS);
  timer.unref();
  app.keeping.set(key, { timer, ref });
}

// Elaia is closing: write what is still waiting now.
export function keepAllNow(app: AppState): void {
  for (const { timer, ref } of app.keeping.values()) {
    clearTimeout(timer);
    keepNow(app, ref);
  }
  app.keeping.clear();
}
