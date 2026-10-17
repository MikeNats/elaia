import type { ReactNode } from 'react';
import { sameRef, threadKey, type Attention, type ThreadRef } from '@/shared';

export interface RowProps {
  refValue: ThreadRef;
  selected: ThreadRef | null;
  busy: string[];
  attention?: Record<string, Attention>;
  // Set by a parent that knows more (an epic waits when one of its tickets does).
  dot?: Attention | null;
  // Not started yet: dimmed, still clickable.
  dim?: boolean;
  onSelect(ref: ThreadRef): void;
  icon: ReactNode;
  label: string;
  title: string;
  extra?: string;
}

// One clickable line in the tree: a project chat, an epic chat or a ticket.
export function Row(props: RowProps) {
  const active = sameRef(props.refValue, props.selected);
  const talking = props.busy.includes(threadKey(props.refValue));
  const dot = props.dot ?? props.attention?.[threadKey(props.refValue)] ?? null;
  return (
    <button
      className={`tree-row${active ? ' active' : ''}${props.dim ? ' tree-row-todo' : ''}`}
      onClick={() => props.onSelect(props.refValue)}
    >
      <span
        className={`tree-dot${dot ? ` tree-dot-${dot}` : ''}`}
        title={dot === 'waiting' ? 'Waiting for your answer' : dot === 'new' ? 'New messages' : ''}
      />
      <span className="tree-icon" title={props.title}>
        {props.icon}
      </span>
      <span className="tree-label">{props.label}</span>
      {props.extra && <span className="tree-extra muted">{props.extra}</span>}
      {talking && <span className="tree-busy">💬</span>}
    </button>
  );
}
