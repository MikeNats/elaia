import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { cleanEnv } from '@/glafka';

export interface Ended {
  code: number | null;
  stderr: string;
  // Set when the command could not start at all.
  missing: boolean;
  // Set when you pressed Stop.
  stopped: boolean;
}

export interface Running {
  done: Promise<Ended>;
  stop(): void;
}

const STDERR_KEEP = 8_000;
const KILL_AFTER_MS = 3_000;

// Signals the whole process group: `sh -c "a | b"` has children that would keep stdout open.
function signalGroup(pid: number | undefined, signal: NodeJS.Signals): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, signal);
  } catch {
    // Already gone.
  }
}

// Starts an agent, sends the prompt on stdin, and hands each stdout line over as it comes.
export function startProcess(opts: {
  command: string;
  args: string[];
  cwd: string;
  input: string;
  // Added to the clean environment (Elaia's `elaia` command on PATH, say).
  env?: Record<string, string>;
  onLine(line: string): void;
}): Running {
  const env = { ...cleanEnv(), ...opts.env };
  const child = spawn(opts.command, opts.args, { cwd: opts.cwd, env, detached: true });
  let stderr = '';
  let stopped = false;
  let closed = false;
  child.stderr.on('data', (d: Buffer) => {
    stderr = (stderr + d.toString()).slice(-STDERR_KEEP);
  });
  createInterface({ input: child.stdout }).on('line', opts.onLine);
  // An agent may quit before reading its prompt. That is its exit code's story, not a crash here.
  child.stdin.on('error', () => undefined);
  child.stdin.end(opts.input);

  const done = new Promise<Ended>((resolve) => {
    child.on('error', (err: NodeJS.ErrnoException) =>
      resolve({ code: null, stderr: err.message, missing: err.code === 'ENOENT', stopped }),
    );
    child.on('close', (code) => {
      closed = true;
      resolve({ code, stderr, missing: false, stopped });
    });
  });
  const stop = () => {
    stopped = true;
    signalGroup(child.pid, 'SIGTERM');
    setTimeout(() => closed || signalGroup(child.pid, 'SIGKILL'), KILL_AFTER_MS).unref();
  };
  return { done, stop };
}
