import {
  threadKey,
  type Snapshot,
  type ThreadEntry,
  type ThreadRef,
  type ToWebview,
} from '@/shared';

export interface ViewState {
  snapshot: Snapshot;
  // Loaded threads by key. A thread loads when you open it, then grows live.
  threads: Record<string, ThreadEntry[]>;
  selected: ThreadRef | null;
  error: string | null;
  // The Elaia tab is in its own window, so it shows its own tree.
  ownWindow: boolean;
}

export type ViewAction = ToWebview | { type: 'select'; ref: ThreadRef } | { type: 'dismiss-error' };

export const initialState: ViewState = {
  snapshot: { projects: [], agentName: 'Claude', busy: [] },
  threads: {},
  selected: null,
  error: null,
  ownWindow: false,
};

export function reduce(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'snapshot':
      return { ...state, snapshot: action.snapshot };
    case 'own-window':
      return { ...state, ownWindow: action.on };
    case 'thread':
      return { ...state, threads: { ...state.threads, [threadKey(action.ref)]: action.entries } };
    case 'entries': {
      const key = threadKey(action.ref);
      const loaded = state.threads[key];
      if (!loaded) return state;
      return { ...state, threads: { ...state.threads, [key]: [...loaded, ...action.entries] } };
    }
    case 'focus':
    case 'select':
      return { ...state, selected: action.ref };
    case 'error':
      return { ...state, error: action.text };
    case 'dismiss-error':
      return { ...state, error: null };
  }
}
