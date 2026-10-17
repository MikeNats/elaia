import type { TicketView } from '@/shared';
import { Fact } from './Fact';
import { QA_ICONS } from './format';

// `code` in a criterion shows in the editor font; the rest stays plain text.
function Inline({ text }: { text: string }) {
  return <>{text.split('`').map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;
}

// glafka writes each criterion as "start → action → what you see": one line each.
function Steps({ text }: { text: string }) {
  const parts = text.split(' → ');
  if (parts.length < 3) return <Inline text={text} />;
  const steps = [
    ['Start', parts[0]],
    ['Do', parts[1]],
    ['See', parts.slice(2).join(' → ')],
  ];
  return (
    <div className="qa-steps">
      {steps.map(([label, value]) => (
        <div key={label} className="qa-step">
          <span className="qa-step-label">{label}</span>
          <span>
            <Inline text={value ?? ''} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function Qa({ ticket }: { ticket: TicketView }) {
  if (ticket.criteria.length === 0) return <Fact label="QA" value="no acceptance criteria" />;
  const results = new Map((ticket.qa?.results ?? []).map((r) => [r.id, r]));
  const passed = ticket.criteria.filter((c) => results.get(c.id)?.result === 'pass').length;
  return (
    <section className="facts-section">
      <h3>
        QA{' '}
        <span className="muted">
          {passed}/{ticket.criteria.length} pass
        </span>
      </h3>
      {ticket.criteria.map((c) => {
        const result = results.get(c.id);
        return (
          <div key={c.id} className={`qa-card qa-${result?.result ?? 'none'}`}>
            <div className="qa-id">
              {QA_ICONS[result?.result ?? ''] ?? '○'} {c.id}
            </div>
            <Steps text={c.text} />
            {result?.evidence && (
              <details className="qa-evidence">
                <summary>Evidence</summary>
                <Inline text={result.evidence} />
              </details>
            )}
          </div>
        );
      })}
    </section>
  );
}
