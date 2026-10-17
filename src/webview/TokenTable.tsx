import type { ProjectState, ThreadRef, TokenRow } from '@/shared';
import { tokens } from './format';

function sum(
  rows: TokenRow[],
  key: 'tokensIn' | 'tokensOut' | 'tokensCacheRead' | 'tokensCacheWrite',
): number | null {
  const values = rows.map((r) => r[key]).filter((v): v is number => typeof v === 'number');
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0);
}

// glafka's runs (coder, reviewer, QA) and Elaia's own chat, side by side.
export function TokenTable({
  project,
  threadRef,
  ticketId,
}: {
  project: ProjectState;
  threadRef: ThreadRef;
  ticketId: string | null;
}) {
  const rows = ticketId ? project.tokens.filter((r) => r.ticket === ticketId) : project.tokens;
  const chat = project.chatTokens[threadRef.thread];
  return (
    <section className="facts-section">
      <h3>Tokens</h3>
      <table className="tokens">
        <thead>
          <tr>
            <th />
            <th>in</th>
            <th>out</th>
            <th>cache read</th>
            <th>cache write</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>glafka runs</td>
            <td>{tokens(sum(rows, 'tokensIn'))}</td>
            <td>{tokens(sum(rows, 'tokensOut'))}</td>
            <td>{tokens(sum(rows, 'tokensCacheRead'))}</td>
            <td>{tokens(sum(rows, 'tokensCacheWrite'))}</td>
          </tr>
          <tr>
            <td>this chat</td>
            <td>{tokens(chat?.in)}</td>
            <td>{tokens(chat?.out)}</td>
            <td>{tokens(chat?.cacheRead)}</td>
            <td>{tokens(chat?.cacheWrite)}</td>
          </tr>
        </tbody>
      </table>
      {chat && <p className="muted">Chat cost so far: ${chat.costUsd.toFixed(2)}</p>}
    </section>
  );
}
