import type { EntryKind, TicketView } from '@/shared';

export const ENTRY_ICONS: Record<EntryKind, string> = {
  you: '🧑',
  agent: '🤖',
  question: '❓',
  approval: '✋',
  progress: '⚙️',
  finding: '⚠️',
  'needs-you': '🔔',
  tool: '🔧',
  'tool-result': '↳',
  error: '✗',
  intro: '',
  cleared: '🧹',
};

// glafka's own summary decides the status, so the tree never disagrees with `poreia`.
// Not a character: the tree draws the olive sprig for it.
export const IDLE = 'idle';

export function ticketStatus(ticket: TicketView): { icon: string; label: string } {
  const text = ticket.summary.text;
  // His pick: ⏳ (the klepsydra) while it works, the olive sprig when idle. The tooltip keeps the reason.
  if (ticket.summary.rank === 1) return { icon: '⏳', label: 'working' };
  if (ticket.closed) return { icon: '✔', label: 'closed' };
  if (text.includes('ready for you')) return { icon: IDLE, label: 'ready for you' };
  if (ticket.summary.rank === 0) return { icon: IDLE, label: 'needs you' };
  return { icon: IDLE, label: ticket.position };
}

export function tokens(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

export function time(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const QA_ICONS: Record<string, string> = { pass: '✅', fail: '❌', cannot: '❓' };

// "https://github.com/owner/repo/pull/43" → "#43 · owner/repo". Any other URL shows as is.
export function prLabel(url: string): string {
  const match = /github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/.exec(url);
  return match ? `#${match[2]} · ${match[1]}` : url;
}
