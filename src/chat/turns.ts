import { threadKey, type ThreadRef } from '@/shared';
import { startTurn, type ChatDeps, type Turn, type TurnRequest, type TurnResult } from './turn';

// Which threads have a turn running. One at a time per thread, so answers never interleave.
export function createTurns() {
  const running = new Map<string, Turn>();
  return {
    isBusy: (ref: ThreadRef) => running.has(threadKey(ref)),
    busyKeys: () => [...running.keys()],
    async run(deps: ChatDeps, req: TurnRequest): Promise<TurnResult> {
      const key = threadKey(req.ref);
      if (running.has(key)) throw new Error('This thread is still answering. Wait, or press Stop.');
      const turn = startTurn(deps, req);
      running.set(key, turn);
      try {
        return await turn.done;
      } finally {
        running.delete(key);
      }
    },
    stop(ref: ThreadRef): boolean {
      const turn = running.get(threadKey(ref));
      turn?.stop();
      return Boolean(turn);
    },
    stopAll(): void {
      for (const turn of running.values()) turn.stop();
    },
  };
}

export type Turns = ReturnType<typeof createTurns>;
