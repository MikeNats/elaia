import { epicSlugOf, PROJECT_THREAD, threadKey, todoOf, type ThreadRef } from '@/shared';
import { ErrorBanner } from './ErrorBanner';
import { OwnTree, WindowLink } from './OwnWindow';
import { Splitter } from './Splitter';
import { Thread } from './Thread';
import { TicketFacts } from './TicketFacts';
import { useColumns } from './useColumns';
import { useHost } from './useHost';
import type { ViewState } from './state';

function titleOf(state: ViewState, ref: ThreadRef): string {
  const project = state.snapshot.projects.find((p) => p.path === ref.project);
  if (ref.thread === PROJECT_THREAD) return `${project?.name ?? ref.project} › Project chat`;
  const todo = todoOf(ref.thread);
  const planned = project?.epics
    .find((e) => e.slug === todo?.slug)
    ?.tickets.find((t) => t.key === todo?.key);
  if (todo) return `${project?.name ?? ''} › ${planned?.title ?? todo.key} (not started)`;
  const slug = epicSlugOf(ref.thread);
  const epic = project?.epics.find((e) => e.slug === slug);
  if (slug) return `${project?.name ?? ''} › Epic: ${epic?.title ?? slug}`;
  const ticket = project?.tickets.find((t) => t.id === ref.thread);
  return `${project?.name ?? ''} › ${ticket?.title ?? ref.thread}`;
}

// The Elaia tab: the thread · the facts. The tree is in VS Code's sidebar, next to it, or
// in the tab itself while the tab has its own window.
export function App() {
  const { state, select, post, local } = useHost();
  const columns = useColumns(state.ownWindow);
  const ref = state.selected;
  const project = ref ? state.snapshot.projects.find((p) => p.path === ref.project) : undefined;
  const ticket = ref && project ? (project.tickets.find((t) => t.id === ref.thread) ?? null) : null;

  return (
    <div className="layout" style={{ gridTemplateColumns: columns.template }}>
      {state.ownWindow && <OwnTree state={state} select={select} post={post} />}
      {state.ownWindow && <Splitter side="left" {...columns} />}
      <main className="column center">
        <ErrorBanner text={state.error} onDismiss={() => local({ type: 'dismiss-error' })} />
        {ref ? (
          <Thread
            title={titleOf(state, ref)}
            threadRef={ref}
            entries={state.threads[threadKey(ref)] ?? []}
            agentName={state.snapshot.agentName}
            busy={state.snapshot.busy.includes(threadKey(ref))}
            queued={state.snapshot.queued?.[threadKey(ref)]}
            models={state.snapshot.models}
            model={state.snapshot.chosenModels?.[threadKey(ref)]}
            post={post}
          />
        ) : (
          <div className="empty">
            <h2>Pick a project chat or a ticket on the left.</h2>
            <p className="muted">Or add a project. Elaia installs glafka in it if needed.</p>
          </div>
        )}
      </main>
      <Splitter side="right" {...columns} />
      <aside className="right" inert={columns.rightClosed}>
        {/* Fixed width inside a column that shrinks: the panel slides out, text never reflows. */}
        <div className="column right-inner" style={{ width: columns.widths.right }}>
          <WindowLink own={state.ownWindow} post={post} />
          {ref && project && (
            <TicketFacts
              project={project}
              ticket={ticket}
              threadRef={ref}
              post={post}
              permissions={state.snapshot.permissions}
              agents={state.snapshot.agents?.[threadKey(ref)]}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
