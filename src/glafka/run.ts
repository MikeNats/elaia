import { execFile } from 'node:child_process';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

const MAX_OUTPUT = 32 * 1024 * 1024;

// Runs glafka inside one project. Never throws for a non-zero exit; the caller decides.
export function runGlafka(
  bin: string,
  args: string[],
  cwd: string,
  timeoutMs = 120_000,
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { cwd, timeout: timeoutMs, maxBuffer: MAX_OUTPUT, env: cleanEnv() },
      (err, stdout, stderr) => {
        const missing = err && 'code' in err && err.code === 'ENOENT';
        if (missing) {
          reject(
            new Error(`glafka was not found at "${bin}". Install it, or set elaia.glafkaPath.`),
          );
          return;
        }
        const code = err && typeof err.code === 'number' ? err.code : err ? 1 : 0;
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

// Markers a child must not inherit. Claude's make an agent think it is nested; Node's IPC
// channel (we run inside a forked host) keeps a child `node` alive forever.
const DROP = ['CLAUDECODE', 'NODE_CHANNEL_FD', 'NODE_CHANNEL_SERIALIZATION_MODE'];

export function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (DROP.includes(key) || key.startsWith('CLAUDE_CODE_')) delete env[key];
  }
  return env;
}
