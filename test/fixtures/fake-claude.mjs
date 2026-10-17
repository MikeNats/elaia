#!/usr/bin/env node
// A stand-in for `claude -p`: logs how it was called, then replays a recorded stream-json file.
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { clearInterval, setInterval, setTimeout } from 'node:timers';

function reply() {
  if (process.env.FAKE_CLAUDE_FAIL) {
    process.stderr.write('fake claude: something broke\n');
    process.exitCode = 1;
    return;
  }
  const resuming = process.argv.includes('--resume') && process.env.FAKE_CLAUDE_RESUME_FIXTURE;
  const fixture = resuming ? process.env.FAKE_CLAUDE_RESUME_FIXTURE : process.env.FAKE_CLAUDE_FIXTURE;
  // A slow agent: the chat stays busy, so a test can send while it runs.
  const delay = Number(process.env.FAKE_CLAUDE_DELAY_MS ?? 0);
  setTimeout(() => process.stdout.write(readFileSync(fixture, 'utf8')), delay);
}

const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  // The CLAUDE* variables it was started with, so a test can see what a child inherits.
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('CLAUDE')));
  const call = { args: process.argv.slice(2), cwd: process.cwd(), stdin: Buffer.concat(chunks).toString(), env };
  appendFileSync(process.env.FAKE_CLAUDE_LOG, `${JSON.stringify(call)}\n`);
  // A held turn answers only once this file exists, so a test can act while the turn runs.
  const hold = process.env.FAKE_CLAUDE_HOLD;
  if (!hold || existsSync(hold)) return reply();
  const wait = setInterval(() => {
    if (!existsSync(hold)) return;
    clearInterval(wait);
    reply();
  }, 20);
});
