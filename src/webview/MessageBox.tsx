import { useState, type KeyboardEvent } from 'react';
import type { ThreadRef } from '@/shared';
import type { Post } from './host';

// Enter sends, Shift+Enter is a new line. While the agent works you can still send: the message
// waits and goes next. Stop shows beside Send. Clear (project chat only) sits at the top, above Send.
export function MessageBox({
  threadRef,
  busy,
  queued = 0,
  canClear = false,
  post,
}: {
  threadRef: ThreadRef;
  busy: boolean;
  queued?: number;
  canClear?: boolean;
  post: Post;
}) {
  const [text, setText] = useState('');
  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    post({ type: 'send', ...threadRef, text: trimmed });
    setText('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };
  const waiting = queued === 1 ? '1 message waits' : `${queued} messages wait`;
  return (
    <div className="message-box">
      <textarea
        value={text}
        placeholder={
          busy
            ? 'The agent is working. Your message waits and goes next.'
            : 'Type a message. Enter sends, Shift+Enter is a new line.'
        }
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
      />
      <div className="message-buttons">
        {canClear && <ClearLink threadRef={threadRef} busy={busy} post={post} />}
        <button onClick={send} disabled={!text.trim()}>
          Send
        </button>
        {busy && (
          <button className="secondary" onClick={() => post({ type: 'stop', ...threadRef })}>
            Stop
          </button>
        )}
      </div>
      {queued > 0 && <p className="muted small queued">{waiting} for the agent to finish.</p>}
    </div>
  );
}

// Project chat only: forget the agent; the next message starts a fresh one.
function ClearLink({ threadRef, busy, post }: { threadRef: ThreadRef; busy: boolean; post: Post }) {
  return (
    <button
      className="link clear"
      disabled={busy}
      title={busy ? 'Wait for the answer, or press Stop' : 'Start a fresh agent'}
      onClick={() => post({ type: 'clear-chat', ...threadRef })}
    >
      Clear
    </button>
  );
}
