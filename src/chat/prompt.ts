import type { ThreadEntry } from '@/shared';

const speaker = (e: ThreadEntry) =>
  e.kind === 'you' ? 'User' : e.source === 'glafka' ? 'glafka' : 'Agent';

// A new session knows nothing. This hands it the ticket and the recent thread, so it can carry on.
export function contextPrompt(opts: {
  ticketId: string | null;
  title: string | null;
  specPath: string | null;
  planPath: string | null;
  folder: string;
  // The chat's name, so the agent can read all of it with `elaia show`.
  thread?: string;
  // The note the last agent left when it was full, if there is one.
  handoff?: string | null;
  tail: ThreadEntry[];
  text: string;
}): string {
  const about = opts.ticketId
    ? `You are continuing glafka ticket ${opts.ticketId}${opts.title ? ` (${opts.title})` : ''}, working in ${opts.folder}.`
    : `You are helping with the project at ${opts.folder}.`;
  const lines = [
    about,
    opts.specPath ? `Spec: ${opts.specPath}` : null,
    opts.planPath ? `Plan: ${opts.planPath}` : null,
    opts.thread
      ? `The whole chat so far: \`elaia show thread:${opts.thread}\`. Past work: \`elaia recall <words>\`.`
      : null,
  ];
  if (opts.handoff) lines.push('', '<handoff-note>', opts.handoff.trim(), '</handoff-note>');
  // Marked blocks, not a "User: / Agent:" script: a script invites the model to write the next line.
  if (opts.tail.length > 0) {
    lines.push('', '<earlier-conversation oldest-first>');
    lines.push(...opts.tail.map((e) => `[${speaker(e)}] ${e.text}`));
    lines.push('</earlier-conversation>');
  }
  // Empty when the message goes on its own (a skill command must be the prompt's first word).
  if (opts.text) lines.push('', 'My new message:', opts.text);
  return lines.filter((l) => l !== null).join('\n');
}
