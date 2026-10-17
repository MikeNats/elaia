import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// A lease older than this belongs to a window that is gone.
const STALE_MS = 150_000;

interface Lease {
  pid: number;
  at: number;
}

// Many VS Code windows share one store. One window keeps the threads, notifies and runs vima;
// it holds a lease file and renews it every tick. The others only show state.
export function createLeader(root: string) {
  const file = path.join(root, 'leader.json');
  const read = (): Lease | null => {
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as Lease;
    } catch {
      return null;
    }
  };
  return {
    tick(): void {
      const lease = read();
      const free = !lease || lease.pid === process.pid || Date.now() - lease.at > STALE_MS;
      if (free) writeFileSync(file, JSON.stringify({ pid: process.pid, at: Date.now() }));
    },
    isLeader: (): boolean => read()?.pid === process.pid,
    release(): void {
      if (read()?.pid !== process.pid) return;
      try {
        unlinkSync(file);
      } catch {
        // Already gone.
      }
    },
  };
}
