import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inboxDir } from '@/epics';
import { PROJECT_THREAD } from '@/shared';
import { note } from './record';
import type { AppState } from './types';

const MAX_BYTES = 15 * 1024 * 1024;

// A name that is safe on disk and does not overwrite a file already there.
function freeName(dir: string, name: string): string {
  const safe = path.basename(name).replace(/[^\w.\- ]/g, '_') || 'file';
  const { name: stem, ext } = path.parse(safe);
  let candidate = safe;
  for (let n = 2; existsSync(path.join(dir, candidate)); n++) candidate = `${stem}-${n}${ext}`;
  return candidate;
}

// Files dropped on the main chat land in docs/elaia/inbox/; the planner moves them into an epic.
export function saveInbox(
  app: AppState,
  project: string,
  files: { name: string; data: string }[],
): void {
  const dir = inboxDir(project);
  mkdirSync(dir, { recursive: true });
  const saved: string[] = [];
  const skipped: string[] = [];
  for (const file of files) {
    const bytes = Buffer.from(file.data, 'base64');
    if (bytes.length > MAX_BYTES) {
      skipped.push(file.name);
      continue;
    }
    const name = freeName(dir, file.name);
    writeFileSync(path.join(dir, name), bytes);
    saved.push(`\`docs/elaia/inbox/${name}\``);
  }
  const ref = { project, thread: PROJECT_THREAD };
  if (saved.length > 0) {
    note(app, ref, 'progress', `Added ${saved.join(', ')}. Ask me to plan an epic from them.`);
  }
  if (skipped.length > 0)
    note(app, ref, 'error', `Too big to add (over 15 MB): ${skipped.join(', ')}`);
}
