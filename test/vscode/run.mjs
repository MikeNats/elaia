// Starts a separate, throwaway VS Code with Elaia loaded and runs suite.cjs inside it.
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests } from '@vscode/test-electron';

// Run from a VS Code terminal, this is set, and the test VS Code would start as plain Node.
delete process.env.ELECTRON_RUN_AS_NODE;

const root = fileURLToPath(new URL('../..', import.meta.url));
const profile = mkdtempSync(path.join(os.tmpdir(), 'elaia-vscode-'));

try {
  await runTests({
    extensionDevelopmentPath: root,
    extensionTestsPath: path.join(root, 'test', 'vscode', 'suite.cjs'),
    launchArgs: [
      '--disable-extensions',
      `--user-data-dir=${path.join(profile, 'user')}`,
      `--extensions-dir=${path.join(profile, 'extensions')}`,
    ],
  });
} catch (err) {
  console.error('VS Code smoke test failed:', err);
  process.exit(1);
}
