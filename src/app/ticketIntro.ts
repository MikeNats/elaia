import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { todoOf, type ThreadEntry, type ThreadRef } from '@/shared';
import { upgradeOldCard } from '@/filter';
import { trustedEpics } from './epicTrust';
import { briefMarkdown } from './introText';
import type { AppState } from './types';

const SPEC_MAX = 600;
const STATE_WORDS: Record<string, string> = {
  waiting: 'not started yet',
  merged: 'merged',
  cancelled: 'cancelled',
};

const card = (lines: string[]): ThreadEntry => ({
  at: '',
  kind: 'intro',
  text: lines.join('\n'),
  shown: true,
  source: 'glafka',
});

// The spec's first paragraph after its headings: what the ticket is about, in short.
function firstParagraph(file: string): string {
  const lines = readFileSync(file, 'utf8').split('\n');
  const start = lines.findIndex((l) => l.trim() && !l.startsWith('#'));
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && !l.trim());
  const text = lines
    .slice(start, end < 0 ? undefined : end)
    .join(' ')
    .trim();
  return text.length > SPEC_MAX ? `${text.slice(0, SPEC_MAX - 1)}…` : text;
}

// The first thing in a ticket's chat: what the ticket is. Made when you open the chat, never
// kept, so it is there for old tickets too and always matches the epic file.
export function introFor(app: AppState, ref: ThreadRef): ThreadEntry | null {
  const todo = todoOf(ref.thread);
  for (const { slug, epic } of trustedEpics(app, ref.project)) {
    const t = epic?.tickets.find((x) =>
      todo ? slug === todo.slug && x.key === todo.key : x.ticketId === ref.thread,
    );
    if (!epic || !t) continue;
    const titles = new Map(epic.tickets.map((x) => [x.key, x.title]));
    const after = t.dependsOn.map((k) => titles.get(k) ?? k);
    const state = todo && STATE_WORDS[t.state] ? ` — ${STATE_WORDS[t.state]}` : '';
    const where = `Epic: ${epic.title}${after.length > 0 ? ` · after: ${after.join(', ')}` : ''}`;
    return card([`### ${t.title}${state}`, '', ...briefMarkdown(t.brief), '', `*${where}*`]);
  }
  if (todo) return null;
  const ticket = app.projects.get(ref.project)?.tickets.find((x) => x.id === ref.thread);
  if (!ticket) return null;
  const spec = ticket.specPath ? path.resolve(ref.project, ticket.specPath) : null;
  const about = spec && existsSync(spec) ? firstParagraph(spec) : '';
  return card([
    `### ${ticket.title ?? ticket.id}`,
    '',
    ...(about ? briefMarkdown(about) : ['No spec yet.']),
  ]);
}

// What a chat shows when you open it: a ticket's chat starts with what the ticket is; a
// not-started ticket has only that.
export function threadPage(app: AppState, ref: ThreadRef): ThreadEntry[] {
  const intro = introFor(app, ref);
  const all = todoOf(ref.thread) ? [] : app.deps.store.threads.read(ref).map(upgradeOldCard);
  // After your Clear the chat starts after the Cleared mark. Older messages stay saved.
  const kept = all.slice(all.findLastIndex((e) => e.kind === 'cleared') + 1);
  return intro ? [intro, ...kept] : kept;
}
