import { useCallback, useEffect, useReducer } from 'react';
import type { ThreadRef, ToWebview } from '@/shared';
import { post, saveState, vscodeApi } from './host';
import { initialState, reduce, type ViewAction } from './state';

function savedSelection(): ThreadRef | null {
  const saved = vscodeApi().getState() as { selected?: ThreadRef } | null;
  return saved?.selected ?? null;
}

// The webview's link to the host: messages in, state out, and the open thread remembered.
// `fixed` is for a ticket chat panel: it shows that one thread and ignores focus requests.
export function useHost(fixed: ThreadRef | null = null) {
  const [state, dispatch] = useReducer(reduce, initialState, (s) => ({
    ...s,
    selected: fixed ?? savedSelection(),
  }));

  useEffect(() => {
    const onMessage = (event: MessageEvent<ToWebview>) => {
      if (fixed && event.data.type === 'focus') return;
      dispatch(event.data);
      if (event.data.type === 'focus') post({ type: 'open-thread', ...event.data.ref });
    };
    window.addEventListener('message', onMessage);
    post({ type: 'ready' });
    const selected = fixed ?? savedSelection();
    if (selected) post({ type: 'open-thread', ...selected });
    return () => window.removeEventListener('message', onMessage);
  }, [fixed]);

  useEffect(() => {
    saveState({ selected: state.selected });
  }, [state.selected]);

  const select = useCallback((ref: ThreadRef) => {
    dispatch({ type: 'select', ref });
    post({ type: 'open-thread', ...ref });
  }, []);

  const local = useCallback((action: ViewAction) => dispatch(action), []);
  return { state, select, post, local };
}
