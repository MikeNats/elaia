import { todoOf, type ThreadRef } from '@/shared';
import type { Post } from './host';
import { ModelPicker } from './ModelPicker';

// The chat's title, its model picker, and Show details.
export function ThreadHeader(p: {
  title: string;
  threadRef: ThreadRef;
  hidden: number;
  details: boolean;
  onToggle(): void;
  models: { id: string; label: string }[];
  model: string;
  busy: boolean;
  post: Post;
}) {
  return (
    <header className="thread-header">
      <h2>{p.title}</h2>
      <div className="thread-tools">
        {!todoOf(p.threadRef.thread) && (
          <ModelPicker threadRef={p.threadRef} models={p.models} model={p.model} post={p.post} />
        )}
        {p.hidden > 0 && (
          <button className="link" onClick={p.onToggle}>
            {p.details ? 'Hide details' : `Show details (${p.hidden} hidden)`}
          </button>
        )}
      </div>
    </header>
  );
}
