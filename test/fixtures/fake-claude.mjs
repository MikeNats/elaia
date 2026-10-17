#!/usr/bin/env node
// A stand-in for `claude -p`: logs how it was called, then replays a recorded stream-json file.
import { appendFileSync, readFileSync } from 'node:fs';

const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const call = { args: process.argv.slice(2), cwd: process.cwd(), stdin: Buffer.concat(chunks).toString() };
  appendFileSync(process.env.FAKE_CLAUDE_LOG, `${JSON.stringify(call)}\n`);
  if (process.env.FAKE_CLAUDE_FAIL) {
    process.stderr.write('fake claude: something broke\n');
    process.exitCode = 1;
    return;
  }
  const resuming = process.argv.includes('--resume') && process.env.FAKE_CLAUDE_RESUME_FIXTURE;
  const fixture = resuming ? process.env.FAKE_CLAUDE_RESUME_FIXTURE : process.env.FAKE_CLAUDE_FIXTURE;
  process.stdout.write(readFileSync(fixture, 'utf8'));
});
