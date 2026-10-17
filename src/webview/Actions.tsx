import type { EntryAction, ThreadRef } from '@/shared';
import type { Post } from './host';

function act(action: EntryAction, shownIn: ThreadRef, post: Post): void {
  const ref = action.thread ? { ...shownIn, thread: action.thread } : shownIn;
  switch (action.kind) {
    case 'reply':
      return post({ type: 'send', ...ref, text: action.value });
    case 'allow':
      return post({ type: 'allow', ...ref, tool: action.value });
    case 'advance':
      return post({ type: 'advance', project: ref.project, ticket: action.value });
    case 'push':
      return post({ type: 'push', project: ref.project, ticket: action.value });
    case 'setup':
      return post({ type: 'setup', project: action.value });
    case 'skip-setup':
      return post({ type: 'skip-setup', project: action.value });
    case 'trust':
      return post({ type: 'trust', project: ref.project, hash: action.value });
    case 'not-trust':
      return post({ type: 'not-trust', project: ref.project });
    case 'setup-step': {
      const [step = '', choice = ''] = action.value.split(':');
      return post({ type: 'setup-step', project: ref.project, step, choice });
    }
    case 'approve-epic':
      return post({
        type: 'approve-epic',
        project: ref.project,
        epic: action.value,
        approval: 'epic',
      });
    case 'approve-tickets':
      return post({
        type: 'approve-epic',
        project: ref.project,
        epic: action.value,
        approval: 'ticket',
      });
    case 'merge':
      return post({ type: 'merge', project: ref.project, ticket: action.value });
    case 'close':
      return post({ type: 'close-ticket', project: ref.project, ticket: action.value });
    case 'cancel':
      return post({ type: 'cancel-ticket', project: ref.project, ticket: action.value });
    case 'start':
      return post({ type: 'start-ticket', ...ref, ticket: action.value });
    case 'open':
      return post({ type: 'show-thread', project: ref.project, thread: action.value });
  }
}

// The buttons under an entry: answer yes/no, allow a tool, push.
export function Actions({
  actions,
  threadRef,
  post,
}: {
  actions?: EntryAction[];
  threadRef: ThreadRef;
  post: Post;
}) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="entry-actions">
      {actions.map((action) => (
        <button key={`${action.kind}-${action.value}`} onClick={() => act(action, threadRef, post)}>
          {action.label}
        </button>
      ))}
    </div>
  );
}
