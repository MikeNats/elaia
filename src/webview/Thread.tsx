import { useEffect, useRef, useState } from 'react';
import { PROJECT_THREAD, todoOf, type ThreadEntry, type ThreadRef } from '@/shared';
import { useAtBottom } from './atBottom';
import { useFileDrop } from './dropFiles';
import { Entry } from './Entry';
import { Message, speakerOf } from './Message';
import type { Post } from './host';
import { MessageBox } from './MessageBox';
import { ThreadHeader } from './ThreadHeader';

interface ThreadProps {
  title: string;
  threadRef: ThreadRef;
  entries: ThreadEntry[];
  agentName: string;
  busy: boolean;
  // Messages you sent while it was busy, still waiting.
  queued?: number;
  // The models this chat can pick, and the one it uses.
  models?: { id: string; label: string }[];
  model?: string;
  post: Post;
}

// One conversation. Only what matters shows; tool work waits behind "show details".
export function Thread(props: ThreadProps) {
  const { title, threadRef, entries, agentName, busy, queued, post } = props;
  const [details, setDetails] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const hidden = entries.filter((e) => !e.shown).length;
  const visible = details ? entries : entries.filter((e) => e.shown);

  // The main chat takes spec files: drop them here (VS Code wants Shift held while dropping).
  const mainChat = threadRef.thread === PROJECT_THREAD;
  const drop = useFileDrop(threadRef, mainChat, post);

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [visible.length]);
  useAtBottom(end, threadRef, post);

  return (
    <section className={`thread${drop.dropping ? ' dropping' : ''}`} {...drop.handlers}>
      <ThreadHeader
        {...{ title, threadRef, hidden, details, busy, post }}
        onToggle={() => setDetails(!details)}
        models={props.models ?? []}
        model={props.model ?? 'default'}
      />
      {mainChat && (
        <p className="drop-hint">
          Plan an epic: drop spec files here (hold Shift), paste text, or name a path.
        </p>
      )}
      <div className="thread-entries">
        {visible.length === 0 && <p className="muted">Nothing here yet. Say something below.</p>}
        {visible.map((entry, i) => {
          const key = `${entry.at}-${i}`;
          const speaker = speakerOf(entry);
          if (!speaker) return <Entry key={key} entry={entry} threadRef={threadRef} post={post} />;
          const before = visible[i - 1];
          const continued = before !== undefined && speakerOf(before) === speaker;
          return (
            <Message key={key} {...{ entry, speaker, agentName, continued, threadRef, post }} />
          );
        })}
        {busy && <p className="muted working">{agentName} is working…</p>}
        <div ref={end} />
      </div>
      {todoOf(threadRef.thread) ? (
        <p className="muted todo-note">
          This ticket has not started, so it has no chat yet. Ask about it in its epic chat.
        </p>
      ) : (
        <MessageBox
          threadRef={threadRef}
          busy={busy}
          queued={queued}
          canClear={mainChat}
          post={post}
        />
      )}
    </section>
  );
}
