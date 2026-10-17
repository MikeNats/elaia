import { existsSync, watch, type FSWatcher } from 'node:fs';

export interface WatchOptions {
  settleMs?: number;
  // Only these paths count. A coder's log changes many times a second and means nothing here.
  relevant?(relativePath: string): boolean;
}

// Says "something changed" once a burst of writes settles. What changed is poreia's job to say.
export function watchFolder(
  dir: string,
  onChange: () => void,
  options: WatchOptions = {},
): () => void {
  const { settleMs = 300, relevant = () => true } = options;
  if (!existsSync(dir)) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let watcher: FSWatcher;
  try {
    watcher = watch(dir, { recursive: true }, (_event, file) => {
      if (file && !relevant(String(file))) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(onChange, settleMs);
    });
  } catch {
    // No recursive watch on this platform: the host's timer still refreshes.
    return () => undefined;
  }
  watcher.on('error', () => undefined);
  return () => {
    if (timer) clearTimeout(timer);
    watcher.close();
  };
}
