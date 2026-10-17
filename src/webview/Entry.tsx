import type { ThreadEntry, ThreadRef } from '@/shared';
import { Actions } from './Actions';
import { ENTRY_ICONS, time } from './format';
import type { Post } from './host';
import { Markdown } from './Markdown';

// Cards that ask you something (permissions, setup) and run reports are Markdown;
// one-line events are plain text.
const needsMarkdown = (entry: ThreadEntry) =>
  entry.kind === 'approval' || (entry.source === 'glafka' && entry.text.includes('\n'));

// A glafka event, a tool call, an error: a short line with its icon.
// What the ticket is, at the top of its chat: a card, not an event line.
function Intro({ entry }: { entry: ThreadEntry }) {
  return (
    <div className="ticket-intro">
      <Markdown text={entry.text} />
    </div>
  );
}

export function Entry({
  entry,
  threadRef,
  post,
}: {
  entry: ThreadEntry;
  threadRef: ThreadRef;
  post: Post;
}) {
  if (entry.kind === 'intro') return <Intro entry={entry} />;
  return (
    <div className={`entry entry-${entry.kind}${entry.shown ? '' : ' entry-detail'}`}>
      <span className="entry-icon" aria-hidden="true">
        {ENTRY_ICONS[entry.kind]}
      </span>
      <div className="entry-body">
        {needsMarkdown(entry) ? (
          <Markdown text={entry.text} />
        ) : (
          <div className="entry-text">
            {entry.text} <span className="entry-time">{time(entry.at)}</span>
          </div>
        )}
        <Actions actions={entry.actions} threadRef={threadRef} post={post} />
      </div>
    </div>
  );
}
