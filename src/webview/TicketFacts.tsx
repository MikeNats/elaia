import type { LiveAgent, ProjectState, ThreadRef, TicketView } from '@/shared';
import { Fact } from './Fact';
import { prLabel } from './format';
import type { Post } from './host';
import { LiveAgents } from './LiveAgents';
import { Permissions } from './Permissions';
import { Qa } from './Qa';
import { TokenTable } from './TokenTable';

interface FactsProps {
  project: ProjectState;
  ticket: TicketView | null;
  threadRef: ThreadRef;
  post: Post;
  permissions?: 'ask' | 'auto';
  agents?: LiveAgent[];
}

// Where the work went: the PR link, and the buttons that act on the ticket.
function PullRequest({
  project,
  ticket,
  post,
}: {
  project: ProjectState;
  ticket: TicketView;
  post: Post;
}) {
  return (
    <section className="facts-section">
      <h3>Pull request</h3>
      {ticket.prUrl ? (
        <a className="pr-link" href={ticket.prUrl} title={ticket.prUrl}>
          {prLabel(ticket.prUrl)}
        </a>
      ) : (
        <p className="muted">Not opened yet.</p>
      )}
      <div className="facts-actions">
        {ticket.worktree && (
          <button
            onClick={() => post({ type: 'open-diff', project: project.path, ticket: ticket.id })}
          >
            Open diff
          </button>
        )}
        {ticket.worktree && (
          <button
            className="secondary"
            onClick={() => post({ type: 'open-folder', project: project.path, ticket: ticket.id })}
          >
            Open folder
          </button>
        )}
        <button
          className="secondary"
          onClick={() => post({ type: 'advance', project: project.path, ticket: ticket.id })}
        >
          Next step (vima)
        </button>
      </div>
    </section>
  );
}

// The right column: the facts about this ticket, and the buttons that act on it.
export function TicketFacts({ project, ticket, threadRef, post, ...live }: FactsProps) {
  const blocking = ticket?.review.findings.filter((f) => f.verdict === 'blocking') ?? [];
  return (
    <div className="facts">
      <LiveAgents agents={live.agents ?? []} />
      <section className="facts-section">
        <h2>{ticket ? 'Ticket' : 'Project'}</h2>
        {ticket && (
          <>
            <Fact label="Stage" value={ticket.position} />
            <Fact label="Coder" value={ticket.coder.state} />
            <Fact label="Checks" value={ticket.checksOutcome ?? '—'} />
            <Fact
              label="Review"
              value={ticket.review.verdict.verdict ?? ticket.review.status.state}
            />
            {blocking.map((f, i) => (
              <p key={i} className="finding">
                ⚠️ {f.finding}
              </p>
            ))}
          </>
        )}
        {!ticket && <Fact label="Open tickets" value={String(project.tickets.length)} />}
      </section>
      {ticket && <Qa ticket={ticket} />}
      {ticket && <PullRequest project={project} ticket={ticket} post={post} />}
      <TokenTable project={project} threadRef={threadRef} ticketId={ticket?.id ?? null} />
      <Permissions mode={live.permissions ?? 'auto'} post={post} />
    </div>
  );
}
