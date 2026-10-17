# Elaia

**Every ticket a worktree. Every worktree an agent. Every project at once.**

Elaia is a multi-agent orchestrator for VS Code, built on [glafka](https://github.com/MikeNats/glafka).

- **A main agent per project.** Give it a spec: it plans an epic and splits it into tickets.
- **Every ticket gets its own git worktree** (its own folder and branch) **and its own agent**,
  which plans, codes, tests and reviews it.
- **All in parallel:** tickets run at the same time, in as many projects as you add.

The project is the tree, an epic is a branch, a ticket is a sprig, and glafka is the owl
that watches each one. **Elaia** (ἐλαία) is Athena's olive tree; on the Athenian coin, the
owl (γλαύξ) stands beside an olive sprig.

**The sidebar** (VS Code's left side):

- **shop** ×
  - <img src="media/icon-main-chat.svg" width="16" alt="tree"> Project chat
  - • <img src="media/icon-epic.svg" width="16" alt="branch"> **Checkout v1** &nbsp; 0/3 &nbsp; ← an epic
    - <img src="media/icon-ticket.svg" width="16" alt="sprig"> Total with VAT
    - ⏳ CSV export
- - Add project

**The Elaia tab** (a ticket open):

```
┌────────────────────────┬────────────┐
│ shop › Total with VAT  │ TICKET     │
│ Plan ready.            │ stage      │
│   [Approve] [Change]   │ QA per AC  │
│ QA finished.           │ review     │
│ ▸ show details (42)    │ tokens     │
├────────────────────────┤ [diff]     │
│ > type a message…      │ [folder]   │
└────────────────────────┴────────────┘
```

## What you get

- **Every project in one place.** Add a repo, and Elaia sets glafka up in it, step by step.
- **A main chat per project.** Give it work, and it decides first: one ticket, or more?
  One ticket: it runs glafka genesis right there (brainstorm, spec, plan) and stops at the
  plan. More: it writes an epic. You can also set the project up there.
- **Epics.** Each epic has its own chat: it cuts the work into tickets, you approve there,
  and every question or approval from its tickets shows up there too, with working
  buttons. Elaia makes the tickets, and the epic chat writes each spec and plan.
- **Start the coder.** A written plan gets a card with **Start the coder**. Elaia then makes
  the ticket's worktree, starts the coder in it, and the ticket gets its own chat. An epic
  you approved as a whole starts its tickets without the card, in parallel where it can.
- **One chat per ticket.** It keeps to its own ticket and worktree. Type a glafka step
  alone (`lysis`, `vima`, `ergon`, `epistle`) and it is done for this ticket.
- **Only what matters is shown:** questions, approvals, progress, QA per criterion.
  Tool calls and full run reports sit behind **Show details**.
- **Buttons for decisions:** answer a question, approve a plan, push when ready,
  then **Merge it** and **Close ticket**. One button for each next step.
- **Few permission cards.** If the agent was refused a tool but found another way, you
  get no card (the refusal is in the details). A card shows only when it is stuck.
- **Dots** on the tree for anything you have not seen yet.
- **Tokens:** glafka's runs and the chat, with cache read and cache write.
- **Usage:** your plan's real limits (session, week, and when each resets), as the agent
  reports them after each chat reply and each glafka run. Claude reports them (2.1.300 or
  newer); another agent shows none until Elaia can read its output. Hover for what Elaia spent.
- **Memory.** Every chat is kept in the repo's `.elaia/` folder, which git ignores.
  Every agent can search it with `elaia recall`.
- **Handoff.** When a chat's agent is 70% full, it writes a handoff note.
  Your next message goes to a fresh agent that gets the note.

## The tree and its icons

| Icon                                                       | Is                                                                                               | Click it                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| <img src="media/icon-main-chat.svg" width="18" alt="tree"> | the **main chat** of a project (the Elaia tree)                                                  | plan epics, set the project up                       |
| <img src="media/icon-epic.svg" width="18" alt="branch">    | an **epic** (an olive branch); `done/total` on the right                                         | its own chat: approve, ask, coordinate               |
| <img src="media/icon-ticket.svg" width="18" alt="sprig">   | a **ticket**, idle (an olive sprig) — ready for you, needs you, or not started; hover says which | the ticket's chat                                    |
| ⏳                                                         | a ticket, **working** (the klepsydra, a water clock)                                             | the ticket's chat                                    |
| ✔                                                          | a ticket, **closed**                                                                             |                                                      |
| small blue dot                                             | something here **you have not seen**                                                             | goes once you open the chat and scroll to its bottom |

The family: the tree is the project, a branch is an epic, a sprig is one ticket.

**The left bar:** the olive tree icon opens Elaia. Its sidebar (the tree) is open while
the Elaia tab is the one you are on, so the icon looks selected exactly then. Switch to
another tab and the sidebar closes; come back and it opens again.

## What is kept, and where

```
<repo>/.elaia/chats/project.jsonl             the main chat      ┐ on this machine only:
<repo>/.elaia/chats/epic-<slug>.jsonl         an epic's chat     │ git ignores .elaia/
<repo>/.elaia/chats/<ticket-id>.jsonl         a ticket's chat    │ (it has its own .gitignore)
<repo>/.elaia/handoffs/<chat>/*.md            handoff notes      ┘
<repo>/docs/elaia/epics/<slug>/epic.json      an epic: its tickets and their state (tracked)
```

- Chats are written as they happen, one JSON line per message. Only what was **shown**
  is kept; tool output stays in VS Code's storage.
- Git never sees them: no noise, and a pasted secret never reaches the repo.
- What matters for the team is still in git: the epic, and glafka's spec, plan and decisions.
- The cost: chats do not travel with the repo. A new clone or another machine starts empty.

## Searching it: `elaia recall`

Elaia puts an `elaia` command on every agent's `PATH` when it starts. Nothing to install.
You do not search yourself: ask any chat, and it answers with links.

```bash
elaia recall vat rounding         # this project
elaia recall vat rounding --all   # every project in Elaia
elaia show thread:epic-checkout-v1
elaia show docs/glafka/tickets/<id>/spec.md --from 40
```

It searches docs, epics, handoff notes and chats. `show` reads only `docs/glafka/`,
`docs/elaia/` and `.elaia/handoffs/` of projects added to Elaia.

## Install

1. Install glafka with `--json` support and link it: `cd glafka && npm install -g .`
2. Install Elaia:
   ```bash
   ./run install-ext
   ```
3. In VS Code: **Reload Window**, then click the olive tree icon in the left bar
   (or run **Elaia: Open Panel**). A new install shows "Elaia was updated" with a
   Reload button.

## How it works

```
 you ──► Elaia ──► your agent CLI (claude -p …) ──► runs glafka skills
            │
            └──► glafka poreia/audit/vima --json  (read-only status, next step)
```

- Elaia **never handles your login.** It runs the agent CLI you already have.
- It reads glafka only through `--json` commands. It never calls
  `ergon --status`, because that command changes tickets.
- The main chat and epic chats may not run `glafka plan` or `glafka ergon`: only
  **Start the coder** makes a worktree and starts a coder. Epic and ticket chats may not
  run `glafka create`, and a ticket chat may not run a step of any other ticket.
- While a coder works, its ticket's chat only reads: no Auto mode, so a command outside
  your allow list (a `cat > file`, say) is refused.
- A ticket's chat starts in its worktree. It may still read the main checkout's
  `docs/glafka/` (its spec and plan).

## Settings

| Setting                | Default                                 | What                                                                                                                               |
| ---------------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `elaia.workflow`       | `glafka`                                | the ticket tool for a new project; more tools can plug in                                                                          |
| `elaia.glafkaPath`     | `glafka`                                | the glafka command                                                                                                                 |
| `elaia.platform`       | `claude`                                | platform for `glafka install`                                                                                                      |
| `elaia.agent`          | `claude`                                | `claude`, or `command` for any other CLI                                                                                           |
| `elaia.claudePath`     | `claude`                                | the Claude Code command                                                                                                            |
| `elaia.agentCommand`   | empty                                   | for `command`: a CLI that reads the prompt on stdin. Empty = glafka's `agents.default`                                             |
| `elaia.permissionMode` | `acceptEdits`                           | Claude permission mode for chat                                                                                                    |
| `elaia.allowedTools`   | skills, glafka, git read, ls/tree/mkdir | tools the chat may use without asking                                                                                              |
| `elaia.autoAdvance`    | `true`                                  | run `glafka vima` when a background run ends                                                                                       |
| `elaia.permissions`    | `auto`                                  | `ask`: a card for each command outside your allow list. `auto`: agents run commands without asking; Elaia's block rules still hold |
| `elaia.handoffAt`      | `70`                                    | % full at which a chat's agent hands over to a fresh one. `0` = never                                                              |

Only your User settings can set these, except `platform` and `handoffAt`. A repo's `.vscode/settings.json` cannot change what Elaia runs.

## Limits today

- **Only Claude** gets resumable sessions, hidden tool calls and handoffs.
  Other CLIs (cursor, gemini, kimi, opencode, copilot) run through `command`:
  the thread is sent again each turn, and their output shows as plain text.
- **Publishing:** Anthropic's docs do not cover a shipped extension that runs
  the user's own `claude` login. Ask Anthropic before you publish.

## Develop

```bash
./run check        # format + lint + typecheck
./run test         # unit + webview tests
./run test:glafka  # against the real glafka on PATH
./run test:vscode  # a throwaway VS Code: open the panel, add a project
./run package      # dist/elaia.vsix
```
