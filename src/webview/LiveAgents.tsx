import { useEffect, useRef, useState } from 'react';
import type { LiveAgent } from '@/shared';

const sameAgent = (a: LiveAgent, b: LiveAgent) =>
  a.startedAt === b.startedAt && a.about === b.about;

// The agents this chat has running right now, and what each one is doing. Gone when they end.
// Click one to see its whole task and every step so far.
export function LiveAgents({ agents }: { agents: LiveAgent[] }) {
  const [picked, setPicked] = useState<LiveAgent | null>(null);
  if (agents.length === 0 && !picked) return null;
  // Keep showing the last news of an agent that ended while its popup was open.
  const live = picked ? agents.find((a) => sameAgent(a, picked)) : undefined;
  return (
    <section className="facts-section">
      <h3>Agents running ({agents.length})</h3>
      <ul className="live-agents">
        {agents.map((a, i) => (
          <li key={i}>
            <button className="live-agent" title="Show more" onClick={() => setPicked(a)}>
              <span className="live-about">{a.about}</span>
              <span className="muted small live-doing">{a.doing}</span>
            </button>
          </li>
        ))}
      </ul>
      {picked && (
        <AgentPopup agent={live ?? picked} ended={!live} onClose={() => setPicked(null)} />
      )}
    </section>
  );
}

function since(startedAt: string): string {
  const minutes = Math.floor((Date.now() - Date.parse(startedAt)) / 60_000);
  return minutes < 1 ? 'less than a minute' : `${minutes} min`;
}

// A popup over the page. Esc, ×, or a click outside closes it.
function AgentPopup(p: { agent: LiveAgent; ended: boolean; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal?.();
  }, []);
  const { agent } = p;
  return (
    <dialog
      ref={ref}
      className="agent-popup"
      onClose={p.onClose}
      onClick={(e) => e.target === ref.current && p.onClose()}
    >
      <div className="agent-popup-body">
        <header>
          <h3>{agent.about}</h3>
          <button className="link" aria-label="Close" onClick={p.onClose}>
            ×
          </button>
        </header>
        <p className="muted">{p.ended ? 'Finished.' : `Running for ${since(agent.startedAt)}.`}</p>
        <h4>Task</h4>
        <p className="agent-task">{agent.task || 'No task text.'}</p>
        <h4>Steps ({agent.steps.length})</h4>
        <ol className="agent-steps">
          {agent.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </div>
    </dialog>
  );
}
