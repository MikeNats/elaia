import type { TicketBrief, TicketPlace, TypedStep } from './types';

export const ticketDocs = (id: string) => `docs/glafka/tickets/${id}`;
export const planFileOf = (id: string) => `${ticketDocs(id)}/plan.md`;

// The main chat only sizes the work and makes the ticket. Its own chat plans it with you.
export const GLAFKA_NEW_TICKET_RULES = [
  'Size first. When I ask for work, decide: is it ONE ticket (one change, built and reviewed on',
  'its own) or MORE? Say in one line which, and why.',
  'One ticket: run exactly one command: glafka create "<the idea in a few words>". Then answer',
  'in one line, "One ticket: <id>. It goes on in its own chat.", and stop.',
  'Do not brainstorm it, ask me about it, or write its spec or plan here: Elaia opens the',
  "ticket's own chat, which does all of that with me. Never run glafka genesis, plan or ergon.",
  'More than one ticket: it is an epic (see Epics below).',
].join('\n');

// A ticket's own chat: glafka genesis for this one ticket, with its questions, up to the plan.
export function glafkaTicketGenesisPrompt(t: TicketBrief): string {
  const sources = t.epic && t.epic.sources.length > 0 ? t.epic.sources.join(', ') : null;
  return [
    `Plan glafka ticket ${t.id} ("${t.title}") with me, here in its own chat.`,
    t.epic
      ? `It is one ticket of the epic "${t.epic.title}" (${t.epic.file}). Its part: ${t.brief}`
      : `What I asked for: ${t.brief}`,
    ...(sources ? [`Sources to read first: ${sources}`] : []),
    '',
    'Use the Skill tool with "glafka:genesis" for this ticket, from step 2: the ticket exists,',
    'so never run `glafka create`. Brainstorm it with me here and ask me your questions.',
    `Write ${ticketDocs(t.id)}/spec.md with its acceptance criteria and run:`,
    `  glafka spec ${t.id} ${ticketDocs(t.id)}/spec.md --title "<short title>"`,
    `Then write ${planFileOf(t.id)}: tasks in order, each with its tests first.`,
    'Then stop with one line: "The plan is ready." Never run `glafka plan` or `glafka ergon`:',
    "Elaia shows a Start button here, makes the ticket's worktree and starts the coder.",
  ].join('\n');
}

// A ticket's chat: this ticket, this worktree, and nothing else.
export function glafkaTicketRules(t: TicketPlace): string {
  const where = t.worktree
    ? `Its worktree is ${t.worktree}${t.branch ? ` (branch ${t.branch})` : ''}. You work only there.`
    : 'It has no worktree yet.';
  return [
    `This chat belongs to glafka ticket ${t.id} ("${t.title}"). ${where}`,
    'Every glafka step I name is for this ticket: "lysis" means `glafka lysis ' + t.id + '`,',
    '"vima" means `glafka vima ' + t.id + '`, and so on. Never ask me which ticket.',
    'Never run glafka for another ticket, never create a ticket, and never edit another',
    `ticket's worktree or the main checkout (except this ticket's own ${ticketDocs(t.id)}/).`,
    'Pushing runs only from the Push it button.',
  ].join('\n');
}

// "lysis", "glafka vima", "/glafka:cancel": one glafka step, typed alone.
const TYPED = /^\s*\/?(?:glafka[:\s]+)?(lysis|epistle|vima|ergon|cancel|poreia)\s*[.!]?\s*$/i;

// A step you typed in a ticket's chat is for that ticket. lysis and epistle are Elaia's Close
// and Push buttons; ergon starts the coder in the background, as in the rest of Elaia.
export function glafkaTypedStep(id: string, text: string): TypedStep | null {
  const step = TYPED.exec(text)?.[1]?.toLowerCase();
  if (!step) return null;
  if (step === 'lysis') return { kind: 'close' };
  if (step === 'epistle') return { kind: 'push' };
  const command = `glafka ${step} ${id}${step === 'ergon' ? ' --background' : ''}`;
  return {
    kind: 'run',
    prompt: [
      `Run exactly this one command: ${command}`,
      'Then show me what it printed, in plain words. Do nothing else: no skill, no edits, no other command.',
    ].join('\n'),
  };
}
