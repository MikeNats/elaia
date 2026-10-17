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

// Set by a running Claude Code session for the programs it starts. A child that inherits them
// thinks it is nested. Node's IPC channel (we run inside a forked host) keeps a child `node`
// alive forever. Your login and provider settings (CLAUDE_CODE_OAUTH_TOKEN,
// CLAUDE_CODE_USE_BEDROCK, ...) are yours, so they stay.
const DROP = [
  'CLAUDECODE',
  'CLAUDE_CODE_ENTRYPOINT',
  'CLAUDE_CODE_CHILD_SESSION',
  'CLAUDE_CODE_SESSION_ID',
  'CLAUDE_CODE_SESSION_ATTENDED',
  'CLAUDE_CODE_EXECPATH',
  'CLAUDE_CODE_MESSAGING_SOCKET',
  'CLAUDE_CODE_MESSAGING_TOKEN',
  'CLAUDE_CODE_BRIDGE_SESSION_ID',
  'CLAUDE_CODE_REMOTE',
  'CLAUDE_CODE_REMOTE_SESSION_ID',
  'CLAUDE_AGENT_SDK_VERSION',
  'CLAUDE_EFFORT',
  'CLAUDE_PID',
  'CLAUDE_JOB_DIR',
  'NODE_CHANNEL_FD',
  'NODE_CHANNEL_SERIALIZATION_MODE',
];

export function cleanEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of DROP) delete env[key];
  return env;
}
