import path from 'node:path';
import { z } from 'zod';
import {
  TicketViewSchema,
  threadKey,
  type ChatTokens,
  type ThreadRef,
  type TicketView,
} from '@/shared';
import { readJson, writeJson } from './files';
import { projectKey } from './keys';

const ViewsSchema = z.record(z.string(), TicketViewSchema);
const TokensSchema = z.object({
  in: z.number(),
  out: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
  costUsd: z.number(),
});
const TokenFileSchema = z.record(z.string(), TokensSchema);
const PublishedSchema = z.array(z.string());

// What we saw last time per ticket. The tracker compares against it, even across restarts.
export function viewsStore(root: string) {
  const file = (project: string) => path.join(root, 'views', `${projectKey(project)}.json`);
  return {
    read: (project: string): Record<string, TicketView> => readJson(file(project), ViewsSchema, {}),
    write: (project: string, views: Record<string, TicketView>) => writeJson(file(project), views),
  };
}

export function tokensStore(root: string) {
  const file = (project: string) => path.join(root, 'tokens', `${projectKey(project)}.json`);
  const read = (project: string): Record<string, ChatTokens> =>
    readJson(file(project), TokenFileSchema, {});
  return {
    read,
    add(ref: ThreadRef, t: ChatTokens): void {
      const all = read(ref.project);
      const old = all[ref.thread] ?? { in: 0, out: 0, cacheRead: 0, cacheWrite: 0, costUsd: 0 };
      all[ref.thread] = {
        in: old.in + t.in,
        out: old.out + t.out,
        cacheRead: old.cacheRead + t.cacheRead,
        cacheWrite: old.cacheWrite + t.cacheWrite,
        costUsd: old.costUsd + t.costUsd,
      };
      writeJson(file(ref.project), all);
    },
  };
}

// Threads already written into their repo. Written once, never again.
export function publishedStore(root: string) {
  const file = path.join(root, 'published.json');
  const list = () => readJson(file, PublishedSchema, []);
  return {
    has: (ref: ThreadRef) => list().includes(threadKey(ref)),
    mark: (ref: ThreadRef) => writeJson(file, [...new Set([...list(), threadKey(ref)])]),
  };
}
