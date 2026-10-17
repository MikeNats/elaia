import { threadKey, type ThreadRef } from '@/shared';
import { ErrorBanner } from './ErrorBanner';
import { Thread } from './Thread';
import { useHost } from './useHost';

// The chat under a review: one ticket's thread and nothing else.
export function ThreadView({ threadRef }: { threadRef: ThreadRef }) {
  const { state, post, local } = useHost(threadRef);
  const project = state.snapshot.projects.find((p) => p.path === threadRef.project);
  const ticket = project?.tickets.find((t) => t.id === threadRef.thread);
  return (
    <div className="thread-only">
      <ErrorBanner text={state.error} onDismiss={() => local({ type: 'dismiss-error' })} />
      <Thread
        title={`${project?.name ?? ''} › ${ticket?.title ?? threadRef.thread}`}
        threadRef={threadRef}
        entries={state.threads[threadKey(threadRef)] ?? []}
        agentName={state.snapshot.agentName}
        busy={state.snapshot.busy.includes(threadKey(threadRef))}
        queued={state.snapshot.queued?.[threadKey(threadRef)]}
        models={state.snapshot.models}
        model={state.snapshot.chosenModels?.[threadKey(threadRef)]}
        post={post}
      />
    </div>
  );
}
