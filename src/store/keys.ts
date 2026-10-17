import { createHash } from 'node:crypto';
import path from 'node:path';

// A folder name for a project: readable, and unique even when two repos share a name.
export function projectKey(projectPath: string): string {
  const hash = createHash('sha1').update(projectPath).digest('hex').slice(0, 8);
  return `${safeName(path.basename(projectPath))}-${hash}`;
}

// Ticket ids are already safe slugs; this guards against anything else.
export function safeName(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_') || '_';
}
