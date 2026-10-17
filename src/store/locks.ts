import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// Is that process still running? EPERM means it runs, as another user.
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// One agent per chat across every VS Code window. A turn holds a small file with its window's
// pid; a file left by a window that is gone counts as free.
export function locksStore(root: string) {
  const dir = path.join(root, 'locks');
  const file = (key: string) =>
    path.join(dir, `${createHash('sha1').update(key).digest('hex')}.json`);
  const holder = (f: string): number | null => {
    try {
      return (JSON.parse(readFileSync(f, 'utf8')) as { pid: number }).pid;
    } catch {
      return null;
    }
  };
  // This window may hold one chat more than once (a retry, an Allow); it lets go at zero.
  const held = new Map<string, number>();
  return {
    // True when this window may run the chat now.
    take(key: string): boolean {
      const f = file(key);
      const pid = holder(f);
      if (pid !== null && pid !== process.pid && alive(pid)) return false;
      mkdirSync(dir, { recursive: true });
      writeFileSync(f, JSON.stringify({ pid: process.pid }));
      held.set(key, (held.get(key) ?? 0) + 1);
      return true;
    },
    release(key: string): void {
      const left = (held.get(key) ?? 1) - 1;
      if (left > 0) return void held.set(key, left);
      held.delete(key);
      const f = file(key);
      if (holder(f) !== process.pid) return;
      try {
        unlinkSync(f);
      } catch {
        // Already gone.
      }
    },
  };
}
