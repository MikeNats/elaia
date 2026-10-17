import { useEffect, useState } from 'react';
import type { LimitWindow, ProviderLimits, Snapshot } from '@/shared';
import type { Post } from './host';

const MINUTE = 60_000;

// The time now, a minute at a time: a window that reset shows 0% without a new report.
function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);
  return now;
}

// "23:30" today; "Thu 09:00" on another day.
function when(iso: string, now: number): string {
  const date = new Date(iso);
  const hm = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const today = date.toDateString() === new Date(now).toDateString();
  return today ? hm : `${date.toLocaleDateString([], { weekday: 'short' })} ${hm}`;
}

function Bar({ w, now }: { w: LimitWindow; now: number }) {
  const over = w.resetsAt !== null && Date.parse(w.resetsAt) <= now;
  const share = over ? 0 : Math.min(1, Math.max(0, w.used));
  return (
    <div className="usage-row">
      <div className="usage-line">
        <span>{w.label}</span>
        <span>{Math.round(share * 100)}%</span>
      </div>
      <div className="usage-track">
        <div
          className={`usage-fill${share >= 0.9 ? ' high' : ''}`}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      {w.resetsAt && (
        <div className="usage-reset">
          {over ? 'reset at' : 'resets'} {when(w.resetsAt, now)}
        </div>
      )}
    </div>
  );
}

// "just now", "8 min ago", then the clock time: how old the numbers are, at a glance.
function ago(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / MINUTE);
  if (minutes < 1) return 'just now';
  return minutes < 60 ? `${minutes} min ago` : `at ${when(iso, now)}`;
}

function Provider({ p, now }: { p: ProviderLimits; now: number }) {
  return (
    <div className="usage-provider">
      <div className="usage-reset">
        {p.provider} · updated {ago(p.at, now)}
      </div>
      {p.windows.map((w) => (
        <Bar key={w.id} w={w} now={now} />
      ))}
    </div>
  );
}

// Your plan's limits, as each provider last reported them. Hover for what Elaia itself spent.
// The ↻ at the far right of the title asks for new numbers now; it spins while an ask runs.
export function UsageBar({ usage, post }: { usage?: Snapshot['usage']; post: Post }) {
  const now = useNow();
  if (!usage) return null;
  const { session, week } = usage.spent;
  const spent = `Elaia spent $${session.toFixed(2)} in 5 hours, $${week.toFixed(2)} in 7 days (API prices).`;
  return (
    <section className="usage" title={spent}>
      <div className="usage-title">
        <h3>Usage</h3>
        <button
          className={`link usage-refresh${usage.refreshing ? ' spinning' : ''}`}
          aria-label="Refresh usage"
          title="Refresh usage"
          disabled={usage.refreshing}
          onClick={() => post({ type: 'refresh-usage' })}
        >
          ↻
        </button>
      </div>
      {usage.failed && !usage.refreshing && (
        <div className="usage-reset">Could not refresh. Try again.</div>
      )}
      {usage.limits.length === 0 ? (
        <div className="usage-reset">No limits reported yet. They show after the next reply.</div>
      ) : (
        usage.limits.map((p) => <Provider key={p.provider} p={p} now={now} />)
      )}
    </section>
  );
}
