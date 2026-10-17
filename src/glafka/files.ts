import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

// glafka's own files that Elaia reads. Kept in one place, so a layout change is one fix.
export const glafkaDir = (project: string) => path.join(project, '.glafka');

// glafka puts every ticket's worktree here, inside the repo.
export const WORKTREES_DIR = '.worktrees';

// The writes that mean a ticket moved. Logs and tool audits change constantly and mean nothing.
const TICKET_FILES = /(^|[\\/])(ticket\.json|stages|exit-code)$/;
export const isTicketChange = (relativePath: string) => TICKET_FILES.test(relativePath);

export interface EndedRun {
  role: string;
  startedAt: string;
  log: string;
  exitCode: number | null;
}

// Background runs that have an exit code. glafka deletes them at close, so copy them first.
export function endedRuns(project: string, ticketId: string): EndedRun[] {
  const runs = path.join(glafkaDir(project), 'tickets', ticketId, 'runs');
  if (!existsSync(runs)) return [];
  return readdirSync(runs).flatMap((role) => {
    const dir = path.join(runs, role);
    const log = path.join(dir, 'log');
    if (!existsSync(path.join(dir, 'exit-code')) || !existsSync(log)) return [];
    const startedFile = path.join(dir, 'started-at');
    const startedAt = existsSync(startedFile)
      ? readFileSync(startedFile, 'utf8').trim()
      : String(Math.round(statSync(log).mtimeMs));
    const code = Number(readFileSync(path.join(dir, 'exit-code'), 'utf8').trim());
    return [{ role, startedAt, log, exitCode: Number.isNaN(code) ? null : code }];
  });
}

const TAIL_BYTES = 256 * 1024;

// The agent's own closing words, from the last result line of a stream-json log.
export function lastResult(logPath: string): string | null {
  const text = readFileSync(logPath, 'utf8').slice(-TAIL_BYTES);
  const lines = text.split('\n').reverse();
  for (const line of lines) {
    if (!line.includes('"type":"result"')) continue;
    try {
      const json = JSON.parse(line) as { result?: unknown };
      if (typeof json.result === 'string') return json.result;
    } catch {
      // A cut line at the start of the tail. Keep looking.
    }
  }
  return null;
}
