import { useCallback, useEffect, useReducer } from 'react';
import type { ThreadRef, ToWebview } from '@/shared';
import { post } from './host';
import { ProjectTree } from './ProjectTree';
import { UsageBar } from './UsageBar';
import { initialState, reduce } from './state';

// What the sidebar needs from the host: the projects, and which thread the panel shows.
const WANTED = new Set<ToWebview['type']>(['snapshot', 'focus', 'error']);

// The sidebar: projects, epics and tickets. A click shows that thread in the Elaia panel.
export function TreeApp() {
  const [state, dispatch] = useReducer(reduce, initialState);
  useEffect(() => {
    document.body.classList.add('in-sidebar');
    const onMessage = (event: MessageEvent<ToWebview>) => {
      if (WANTED.has(event.data.type)) dispatch(event.data);
    };
    window.addEventListener('message', onMessage);
    post({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const select = useCallback((ref: ThreadRef) => {
    dispatch({ type: 'select', ref });
    post({ type: 'show-thread', ...ref });
  }, []);
  return (
    <>
      <UsageBar usage={state.snapshot.usage} post={post} />
      <ProjectTree
        projects={state.snapshot.projects}
        selected={state.selected}
        busy={state.snapshot.busy}
        attention={state.snapshot.attention}
        working={Object.keys(state.snapshot.agents ?? {})}
        post={post}
        onSelect={select}
      />
    </>
  );
}
