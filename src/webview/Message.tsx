import type { ThreadEntry, ThreadRef } from '@/shared';
import { Actions } from './Actions';
import { time } from './format';
import type { Post } from './host';
import { Markdown } from './Markdown';

export type Speaker = 'you' | 'agent';

// You and the agent talk in messages. Everything else (glafka, tools, errors) is an Entry.
export function speakerOf(entry: ThreadEntry): Speaker | null {
  if (entry.kind === 'you') return 'you';
  if (entry.source !== 'chat') return null;
  // The agent's own yes/no question is speech. A refused-tool card (it has Allow) is not.
  const actions = entry.actions ?? [];
  const asked = actions.some((a) => a.kind === 'reply') && !actions.some((a) => a.kind === 'allow');
  return entry.kind === 'agent' || entry.kind === 'question' || (entry.kind === 'approval' && asked)
    ? 'agent'
    : null;
}

interface MessageProps {
  entry: ThreadEntry;
  speaker: Speaker;
  agentName: string;
  // Same speaker as the message above: no name line again.
  continued: boolean;
  threadRef: ThreadRef;
  post: Post;
}

export function Message({ entry, speaker, agentName, continued, threadRef, post }: MessageProps) {
  return (
    <div className={`message message-${speaker}${continued ? ' continued' : ''}`}>
      {!continued && (
        <div className="message-head">
          <span className="message-name">{speaker === 'you' ? 'You' : agentName}</span>
          <span className="message-time">{time(entry.at)}</span>
        </div>
      )}
      {speaker === 'agent' ? (
        <Markdown text={entry.text} />
      ) : (
        <div className="entry-text">{entry.text}</div>
      )}
      <Actions actions={entry.actions} threadRef={threadRef} post={post} />
    </div>
  );
}
