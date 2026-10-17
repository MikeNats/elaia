import {
  epicThread,
  type Attention,
  type EpicView,
  type ProjectState,
  type ThreadRef,
} from '@/shared';
import { Bough } from './Bough';
import { TicketRow, TodoRow } from './TicketRows';
import { Row } from './TreeRow';

interface Props {
  project: ProjectState;
  selected: ThreadRef | null;
  busy: string[];
  attention?: Record<string, Attention>;
  working?: string[];
  onSelect(ref: ThreadRef): void;
}

function Epic({
  epic,
  project,
  ...rest
}: Omit<Props, 'project'> & { epic: EpicView; project: ProjectState }) {
  const done = epic.tickets.filter((t) => t.state === 'merged').length;
  // The epic waits for you when it, or one of its tickets, does.
  const keyOf = (thread: string) => `${project.path}::${thread}`;
  const own = rest.attention?.[keyOf(epicThread(epic.slug))] ?? null;
  const ticketWaits = epic.tickets.some(
    (t) => t.ticketId && rest.attention?.[keyOf(t.ticketId)] === 'waiting',
  );
  return (
    <div className="tree-epic">
      <Row
        {...rest}
        refValue={{ project: project.path, thread: epicThread(epic.slug) }}
        icon={<Bough />}
        label={epic.title}
        title={`Epic chat · ${epic.status}`}
        dot={ticketWaits ? 'waiting' : own}
        extra={
          epic.tickets.length === 0
            ? 'planning…'
            : `${done}/${epic.tickets.length}${epic.status === 'proposed' ? ' · needs your OK' : ''}`
        }
      />
      {epic.tickets.map((t) => {
        const live = project.tickets.find((x) => x.id === t.ticketId);
        if (live)
          return (
            <TicketRow key={t.key} ticket={live} name={t.title} project={project.path} {...rest} />
          );
        return <TodoRow key={t.key} {...rest} project={project.path} slug={epic.slug} ticket={t} />;
      })}
    </div>
  );
}

// Tickets grouped under their epic; tickets that belong to no epic come after, under "Other".
export function EpicTickets({ project, ...rest }: Props) {
  const inEpic = new Set(project.epics.flatMap((e) => e.tickets.map((t) => t.ticketId)));
  const other = project.tickets.filter((t) => !inEpic.has(t.id));
  return (
    <>
      {project.epics.map((epic) => (
        <Epic key={epic.slug} epic={epic} project={project} {...rest} />
      ))}
      {project.epics.length > 0 && other.length > 0 && (
        <div className="tree-epic-header">Other</div>
      )}
      {other.map((ticket) => (
        <div key={ticket.id} className="tree-loose">
          <TicketRow ticket={ticket} project={project.path} {...rest} />
        </div>
      ))}
    </>
  );
}
