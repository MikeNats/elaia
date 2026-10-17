import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// A lock older than this was left by a crash, even when its pid now runs something else.
// The same as leader.json's lease.
const STALE_MS = 150_000;
// While a turn runs, its window writes the time again this often, so the lock never looks old.
const REFRESH_MS = 30_000;

interface Lock {
  pid: number;
  at?: number;
}

// Is that process still running? EPERM means it runs, as another user.
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// Free when nobody holds it, this window holds it, or its holder is gone: a dead pid or an old
// time. A lock with no time was written by an older Elaia, so it counts as old.
function free(lock: Lock | null): boolean {
  if (!lock || lock.pid === process.pid) return true;
  const old = typeof lock.at !== 'number' || Date.now() - lock.at > STALE_MS;
  return old || !alive(lock.pid);
}

// One agent per chat across every VS Code window. A turn holds a small file with its window's
// pid and a time, and its window writes the time again while the turn runs.
export function locksStore(root: string) {
  const dir = path.join(root, 'locks');
  const file = (key: string) =>
    path.join(dir, `${createHash('sha1').update(key).digest('hex')}.json`);
  const read = (f: string): Lock | null => {
    try {
      return JSON.parse(readFileSync(f, 'utf8')) as Lock;
    } catch {
      return null;
    }
  };
  const write = (f: string) =>
    writeFileSync(f, JSON.stringify({ pid: process.pid, at: Date.now() }));
  // Only while the file is still this window's: a lock another window took stays its own.
  const refresh = (f: string) => () => {
    try {
      if (read(f)?.pid === process.pid) write(f);
    } catch {
      // A full or read-only disk: the next refresh tries again.
    }
  };
  // This window may hold one chat more than once (a retry, an Allow); it lets go at zero.
  const held = new Map<string, { count: number; timer: NodeJS.Timeout }>();
  return {
    // True when this window may run the chat now.
    take(key: string): boolean {
      const f = file(key);
      if (!free(read(f))) return false;
      mkdirSync(dir, { recursive: true });
      write(f);
      const mine = held.get(key);
      if (mine) mine.count += 1;
      else {
        const timer = setInterval(refresh(f), REFRESH_MS);
        timer.unref();
        held.set(key, { count: 1, timer });
      }
      return true;
    },
    release(key: string): void {
      const mine = held.get(key);
      if (mine && mine.count > 1) return void (mine.count -= 1);
      if (mine) clearInterval(mine.timer);
      held.delete(key);
      const f = file(key);
      if (read(f)?.pid !== process.pid) return;
      try {
        unlinkSync(f);
      } catch {
        // Already gone.
      }
    },
  };
}
