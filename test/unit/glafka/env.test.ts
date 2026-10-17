import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanEnv } from '@/glafka';

// What a running Claude Code session sets for the programs it starts, and Node's IPC channel.
const MARKERS = [
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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('clean environment', () => {
  it('keeps your login and provider settings, and drops the nested marker', () => {
    vi.stubEnv('CLAUDE_CODE_OAUTH_TOKEN', 'tok-123');
    vi.stubEnv('CLAUDE_CODE_USE_BEDROCK', '1');
    vi.stubEnv('CLAUDECODE', '1');
    const env = cleanEnv();
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBe('tok-123');
    expect(env.CLAUDE_CODE_USE_BEDROCK).toBe('1');
    expect(env).not.toHaveProperty('CLAUDECODE');
  });

  it('drops every session marker', () => {
    for (const key of MARKERS) vi.stubEnv(key, 'x');
    const env = cleanEnv();
    expect(MARKERS.filter((key) => key in env)).toEqual([]);
  });
});
