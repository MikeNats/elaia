// Runs inside VS Code. Uses the real glafka on PATH and no agent.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, realpathSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vscode = require('vscode');

async function until(check, what) {
  for (let i = 0; i < 100; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for: ${what}`);
}

function repoWithTicket() {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'elaia-smoke-')));
  const run = (cmd, args) => execFileSync(cmd, args, { cwd: dir, encoding: 'utf8' });
  run('git', ['init', '-q', '-b', 'main']);
  run('git', [
    '-c',
    'user.email=t@t',
    '-c',
    'user.name=t',
    'commit',
    '-q',
    '--allow-empty',
    '-m',
    'init',
  ]);
  const id = JSON.parse(
    run(process.env.GLAFKA_BIN || 'glafka', ['create', 'smoke test', '--json']),
  ).id;
  return { dir, id };
}

exports.run = async function run() {
  const ext = vscode.extensions.getExtension('mtsougkranis.elaia');
  assert.ok(ext, 'Elaia is installed in the test VS Code');
  const api = await ext.activate();
  assert.ok(api.app, 'Elaia started: its settings are valid');

  await vscode.commands.executeCommand('elaia.open');
  await until(() => api.isPanelOpen(), 'the Elaia panel to open');

  const { dir, id } = repoWithTicket();
  await api.app.addProject(dir);
  assert.ok(api.app.ticket({ project: dir, thread: id }), 'the new ticket shows in Elaia');
  console.log('Elaia smoke test passed: panel opened, project added, ticket listed.');
};
