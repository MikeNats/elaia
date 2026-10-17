import { CHOICES_PREFIX } from '@/filter';

// Told to Claude on every Elaia turn. There is no pop-up here, so questions come as text,
// and a fixed set of answers comes as one line that Elaia turns into buttons.
export const CHAT_RULES = [
  'You are running inside Elaia, a chat panel with no pop-ups. Never use AskUserQuestion.',
  'Ask questions as plain text, one question per message.',
  'When the answer is a pick from a short list, end the message with one line exactly like:',
  `${CHOICES_PREFIX} first option | second option | third option`,
  'Use 2 to 5 short options. Then stop and wait for the reply.',
  'Elaia hides tool output from me. Before you ask me to decide about something a command',
  'printed (a list, findings, a diff), show it in your message, in plain words.',
  'Run glafka as `glafka …`; it is on your PATH. Never `npx glafka`: npx may download another package.',
  '',
  'Memory: past epics, tickets, specs, plans, decisions and chats are searchable.',
  'Run `elaia recall <words>` (add --all for every project), then `elaia show <ref>` to read one.',
  'Look there before you ask me something that may already be decided.',
].join('\n');

// Told to every ticket chat: Elaia watches background runs, so the chat never has to.
export const TICKET_RULES = [
  'Once a background coder, tester or reviewer is running, stop and end your turn.',
  'Elaia watches it and posts its progress in this chat. Never wait for it, sleep, or poll its status.',
].join('\n');

// Told to the main chat only: how to cut work of more than one ticket into an epic Elaia can run.
export const EPIC_RULES = [
  'Epics: when the work is more than one ticket, or I say "epic", your whole turn is two steps:',
  '1. Write docs/elaia/epics/<short-slug>/epic.json from my words alone (the slug is short',
  '   kebab-case, like "publish-polish"), in exactly this shape:',
  '   {"title": "...", "goal": "one line", "brief": "what the epic chat must find out and do, in my words",',
  '    "sources": ["paths"], "ordered": false, "tickets": []}',
  '2. Answer in one line, "Created the epic <title>; its own chat takes it from here.", and stop.',
  'Once you know it is an epic, do not explore, read code, start subagents, brainstorm or run commands,',
  "even to write a better brief: the epic's own chat does all research, reviews and the ticket cut, and",
  'Elaia starts it the moment the file exists. This overrides any skill that says to explore first.',
  'If I dropped files in docs/elaia/inbox/, move them to docs/elaia/epics/<slug>/sources/ and list them',
  'in "sources". Leave "ordered": false unless I said in words that the work must run step by step.',
  'If I say "approve" about an epic, tell me to press Approve on the card in the epic chat.',
  'Once a ticket has its own chat, its work happens there, not here.',
].join('\n');
