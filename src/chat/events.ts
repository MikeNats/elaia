import type { AgentEvent } from '@/agents';
import { toEntries } from '@/filter';
import type { ThreadEntry, ThreadRef } from '@/shared';
import type { Store } from '@/store';

// Turns agent events into thread entries, and keeps the session and token books.
export function eventHandler(opts: {
  store: Store;
  ref: ThreadRef;
  folder: string;
  resumed: boolean;
  now(): string;
  record(entries: ThreadEntry[]): void;
  agents(event: AgentEvent): void;
}) {
  const { store, ref, folder } = opts;
  let sawSession = false;
  let resumeFailed = false;
  let context: { used: number; window: number } | null = null;
  return {
    resumeFailed: () => resumeFailed,
    context: () => context,
    handle(events: AgentEvent[]): void {
      for (const event of events) {
        if (event.kind === 'session') {
          sawSession = true;
          store.sessions.set(ref, folder, event.sessionId);
        }
        // A resume that never started a session: the saved one is gone. Stay quiet; the caller retries.
        if (event.kind === 'done' && event.isError && opts.resumed && !sawSession) {
          resumeFailed = true;
          store.sessions.forget(ref, folder);
          continue;
        }
        if (event.kind === 'done' && event.tokens) {
          store.tokens.add(ref, event.tokens);
          const t = event.tokens;
          const tokens = t.in + t.out + t.cacheRead + t.cacheWrite;
          store.usage.add({ at: opts.now(), ...ref, cost: t.costUsd, tokens, source: 'chat' });
        }
        if (event.kind === 'done' && event.context) context = event.context;
        if (event.kind === 'limits')
          store.limits.set({ provider: event.provider, at: opts.now(), windows: event.windows });
        // Live news for the right panel: running agents, tokens so far.
        if (event.kind.startsWith('agent-') || event.kind === 'tokens') opts.agents(event);
        opts.record(toEntries(event, opts.now()));
      }
    },
  };
}
