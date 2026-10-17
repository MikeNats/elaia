import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FAKE_CLAUDE = fileURLToPath(new URL('../fixtures/fake-claude.mjs', import.meta.url));
chmodSync(FAKE_CLAUDE, 0o755);

export interface FakeCall {
  args: string[];
  cwd: string;
  stdin: string;
  // The CLAUDE* variables it was started with.
  env: Record<string, string>;
}

// Points the fake at a recorded turn and returns how it was called.
export function fakeClaude(fixture: 'turn' | 'deny' | 'resume-fail' | 'limits') {
  const dir = mkdtempSync(path.join(tmpdir(), 'elaia-fake-claude-'));
  const log = path.join(dir, 'calls.jsonl');
  process.env.FAKE_CLAUDE_LOG = log;
  process.env.FAKE_CLAUDE_FIXTURE = fileURLToPath(
    new URL(`../fixtures/claude/${fixture}.jsonl`, import.meta.url),
  );
  delete process.env.FAKE_CLAUDE_FAIL;
  delete process.env.FAKE_CLAUDE_HANG;
  delete process.env.FAKE_CLAUDE_RESUME_FIXTURE;
  delete process.env.FAKE_CLAUDE_HOLD;
  delete process.env.FAKE_CLAUDE_DELAY_MS;
  return {
    calls(): FakeCall[] {
      if (!existsSync(log)) return [];
      // The file can exist a moment before the fake writes its line.
      return readFileSync(log, 'utf8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as FakeCall);
    },
    fail() {
      process.env.FAKE_CLAUDE_FAIL = '1';
    },
    // Reads the prompt, then never answers until it is stopped.
    hang() {
      process.env.FAKE_CLAUDE_HANG = '1';
    },
    // Every --resume fails the way a cleaned-away session does.
    resumeFails() {
      process.env.FAKE_CLAUDE_RESUME_FIXTURE = fileURLToPath(
        new URL('../fixtures/claude/resume-fail.jsonl', import.meta.url),
      );
    },
    // Every turn waits until the returned release() is called, so a test can act while one runs.
    hold(): () => void {
      const file = path.join(dir, 'release');
      process.env.FAKE_CLAUDE_HOLD = file;
      return () => writeFileSync(file, '');
    },
    // Each call waits this long before it answers, so the chat stays busy meanwhile.
    slow(ms: number) {
      process.env.FAKE_CLAUDE_DELAY_MS = String(ms);
    },
  };
}
