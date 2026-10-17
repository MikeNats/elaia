import { existsSync, watch, type FSWatcher } from 'node:fs';

export interface WatchOptions {
  settleMs?: number;
  // Only these paths count. A coder's log changes many times a second and means nothing here.
  relevant?(relativePath: string): boolean;
}

// Says "something changed" once a burst of writes settles, with the paths that changed in it
// (relative to `dir`, each once). What changed inside them is the caller's job to read.
export function watchFolder(
  dir: string,
  onChange: (paths: string[]) => void,
  options: WatchOptions = {},
): () => void {
  const { settleMs = 300, relevant = () => true } = options;
  if (!existsSync(dir)) return () => undefined;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let changed = new Set<string>();
  const settle = () => {
    const paths = [...changed];
    changed = new Set();
    onChange(paths);
  };
  let watcher: FSWatcher;
  try {
    watcher = watch(dir, { recursive: true }, (_event, file) => {
      if (file && !relevant(String(file))) return;
      if (file) changed.add(String(file));
      if (timer) clearTimeout(timer);
      timer = setTimeout(settle, settleMs);
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
