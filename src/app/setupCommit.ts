import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cleanEnv } from '@/glafka';
import { messageOf, note, workflowOf } from './record';
import { projectRef, setupCard, stepButton } from './setupCards';
import type { AppState } from './types';

const run = promisify(execFile);
const SHOWN = 8;

// Hooks may run node: cleanEnv keeps it from hanging on Elaia's own IPC channel.
async function git(project: string, args: string[]): Promise<string> {
  return (await run('git', args, { cwd: project, env: cleanEnv() })).stdout.trim();
}
const gitOrEmpty = (project: string, args: string[]) => git(project, args).catch(() => '');

// Tickets start from committed code, so the setup counts only once it is committed.
export async function commitCard(app: AppState, project: string, files: string[]): Promise<void> {
  const [branch, name, email] = await Promise.all([
    gitOrEmpty(project, ['branch', '--show-current']),
    gitOrEmpty(project, ['config', 'user.name']),
    gitOrEmpty(project, ['config', 'user.email']),
  ]);
  const shown = files.slice(0, SHOWN).map((f) => `- \`${f}\``);
  if (files.length > SHOWN) shown.push(`- and ${files.length - SHOWN} more`);
  const who = email ? ` as ${name} <${email}>` : '';
  const text = [
    '**Commit the setup?** Tickets only see committed files.',
    `On \`${branch || 'HEAD'}\`${who}:`,
    '',
    ...shown,
  ].join('\n');
  setupCard(app, project, text, [
    stepButton('commit', 'commit', 'Commit'),
    stepButton('commit', 'later', 'Not now'),
  ]);
}

// One commit with only the setup's files: anything else you have staged stays out of it.
export async function commitSetup(app: AppState, project: string): Promise<void> {
  const ref = projectRef(project);
  const workflow = workflowOf(app, project);
  const files = workflow.setupFiles(project);
  if (files.length === 0) return note(app, ref, 'progress', 'Nothing to commit.');
  try {
    await git(project, ['add', '--', ...files]);
    await git(project, ['commit', '-m', `Set up ${workflow.name}`, '--only', '--', ...files]);
    const sha = await gitOrEmpty(project, ['rev-parse', '--short', 'HEAD']);
    note(app, ref, 'progress', `Setup committed (${sha}).`);
  } catch (err) {
    note(app, ref, 'error', `Commit failed: ${messageOf(err).split('\n').slice(-3).join(' ')}`);
  }
}
