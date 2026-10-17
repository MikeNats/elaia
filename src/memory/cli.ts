import path from 'node:path';
import { parseArgs } from 'node:util';
import { createStore } from '@/store';
import { workflowFor } from '@/workflow';
import type { MemoryProject } from './library';
import { recall } from './recall';
import { show } from './show';

const HELP = `elaia — search what Elaia remembers: epics, tickets, specs, plans, decisions, chats.

  elaia recall <words>          search this project
  elaia recall <words> --all    search every project in Elaia
  elaia show <ref>              read one result (a file, or thread:<chat name>)

Options: --limit N (recall, default 5) · --from N (show: start at line or message N)
         --project PATH (instead of the folder you are in)`;

const memoryProject = (p: string): MemoryProject => ({
  path: p,
  docsDir: workflowFor(p, { workflow: 'glafka', glafkaPath: 'glafka' }).docsDir(p),
});

// The project this folder belongs to; a ticket's worktree sits inside its project.
function projectOf(known: string[], folder: string): string | null {
  const inside = known.filter((p) => folder === p || folder.startsWith(`${p}${path.sep}`));
  return inside.sort((a, b) => b.length - a.length)[0] ?? null;
}

function main(argv: string[]): string {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      project: { type: 'string' },
      all: { type: 'boolean', default: false },
      limit: { type: 'string', default: '5' },
      from: { type: 'string', default: '0' },
    },
  });
  const [command, ...words] = positionals;
  if (!command || command === 'help') return HELP;
  const root = process.env.ELAIA_STORE;
  if (!root) return 'Elaia did not say where its store is. Run this from an Elaia chat.';
  const store = createStore(root);
  const known = store.projects.list().map((p) => p.path);
  const asked = values.project ? path.resolve(values.project) : null;
  if (asked && !known.includes(asked)) return `${asked} is not a project in Elaia.`;
  const here = asked ?? projectOf(known, process.cwd());
  if (command === 'recall') {
    const query = words.join(' ').trim();
    if (!query) return 'Say what to look for: elaia recall <words>';
    const scope = values.all || !here ? known : [here];
    const limit = Number(values.limit) || 5;
    return recall({
      store,
      projects: scope.map(memoryProject),
      here: values.all ? null : here,
      query,
      limit,
    });
  }
  if (command === 'show') {
    if (!words[0]) return 'Say what to read: elaia show <ref> (refs come from elaia recall).';
    if (!here) return 'This folder is not an Elaia project. Add --project PATH.';
    return show(store, memoryProject(here), words[0], Number(values.from) || 0);
  }
  return `Unknown command "${command}".\n\n${HELP}`;
}

try {
  process.stdout.write(`${main(process.argv.slice(2))}\n`);
} catch (err) {
  process.stderr.write(`elaia: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}
