import {
  threadKey,
  todoThread,
  type Attention,
  type EpicView,
  type ThreadRef,
  type TicketView,
} from '@/shared';
import { IDLE, ticketStatus } from './format';
import { Sprig } from './Sprig';
import { Row } from './TreeRow';

export interface RowsProps {
  selected: ThreadRef | null;
  busy: string[];
  // Thread keys with an agent or glafka step running now: their ticket shows ⏳.
  working?: string[];
  attention?: Record<string, Attention>;
  onSelect(ref: ThreadRef): void;
}

const STATE_ICONS: Record<string, string> = { merged: '✔', cancelled: '✗' };

export function TicketRow({
  ticket,
  name,
  ...rest
}: RowsProps & { ticket: TicketView; project: string; name?: string }) {
  const status = ticketStatus(ticket);
  const working = rest.working?.includes(threadKey({ project: rest.project, thread: ticket.id }));
  return (
    <Row
      {...rest}
      refValue={{ project: rest.project, thread: ticket.id }}
      icon={working ? '⏳' : status.icon === IDLE ? <Sprig /> : status.icon}
      label={ticket.title ?? name ?? ticket.id}
      title={working ? 'working' : status.label}
    />
  );
}

// An epic's ticket that has not started (or has closed): dimmed, and a click shows its plan.
export function TodoRow({
  ticket,
  slug,
  ...rest
}: RowsProps & { ticket: EpicView['tickets'][number]; project: string; slug: string }) {
  return (
    <Row
      {...rest}
      refValue={{ project: rest.project, thread: todoThread(slug, ticket.key) }}
      icon={STATE_ICONS[ticket.state] ?? <Sprig />}
      label={ticket.title}
      title={ticket.state === 'waiting' ? 'Not started yet' : ticket.state}
      dim
    />
  );
}
