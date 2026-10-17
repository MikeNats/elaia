import { diffTicket } from '@/track';
import type { TicketView } from '@/shared';
import { closeTicket } from './close';
import { epicViews, offerCuts } from './epicCard';
import { runEpics } from './epicRunner';
import { copyRuns } from './runs';
import { messageOf, notifyIfNeeded, postSnapshot, record, workflowOf } from './record';
import { autoAdvance } from './advance';
import { explainStop, stopMoved } from './nextStep';
import { offerPlans } from './planCard';
import { offerGoneWorktrees } from './worktreeGone';
import { offerTrust } from './trustCard';
import type { AppState } from './types';

// One refresh per project at a time. A request that lands mid-refresh runs once more after.
export function refresh(app: AppState, projectPath: string): Promise<void> {
  const running = app.refreshing.get(projectPath);
  if (running) {
    app.again.add(projectPath);
    return running;
  }
  const work = (async () => {
    do {
      app.again.delete(projectPath);
      await refreshOnce(app, projectPath);
    } while (app.again.has(projectPath));
  })().finally(() => app.refreshing.delete(projectPath));
  app.refreshing.set(projectPath, work);
  return work;
}

async function refreshOnce(app: AppState, projectPath: string): Promise<void> {
  const state = app.projects.get(projectPath);
  if (!state) return;
  // A repo that can run things you have not trusted: its card in the main chat. It comes before
  // the not-installed return: a repo without glafka can still ship Claude hooks.
  if (app.deps.isLeader()) offerTrust(app, projectPath);
  const workflow = workflowOf(app, projectPath);
  // Not set up yet: no tickets to read. The setup card in the project chat says what to do.
  if (!workflow.isInstalled(projectPath)) {
    state.tickets = [];
    state.error = null;
    postSnapshot(app);
    return;
  }
  let tickets: TicketView[];
  try {
    tickets = await workflow.tickets(projectPath);
  } catch (err) {
    state.error = messageOf(err);
    postSnapshot(app);
    return;
  }
  // Only one VS Code window keeps the threads and runs epics; the others just show the state.
  const leader = app.deps.isLeader();
  const ended = leader ? await track(app, projectPath, tickets) : [];
  if (leader) {
    offerCuts(app, projectPath);
    await runEpics(app, projectPath, new Set(tickets.map((t) => t.id)));
  }
  // Before the plan cards: a Start pressed now must see the tickets as they are.
  state.tickets = tickets;
  if (leader) offerPlans(app, projectPath, tickets);
  state.epics = epicViews(app, projectPath);
  state.error = null;
  state.tokens = await workflow.tokens(projectPath).catch(() => state.tokens);
  state.chatTokens = app.deps.store.tokens.read(projectPath);
  postSnapshot(app);
  if (app.deps.settings().autoAdvance)
    for (const { id, roles } of ended) void autoAdvance(app, projectPath, id, roles);
}

// Writes what changed into each ticket's thread. Returns the tickets whose background run just ended.
async function track(
  app: AppState,
  projectPath: string,
  tickets: TicketView[],
): Promise<{ id: string; roles: string[] }[]> {
  const { store, now } = app.deps;
  const old = store.views.read(projectPath);
  const ended: { id: string; roles: string[] }[] = [];
  for (const ticket of tickets) {
    const ref = { project: projectPath, thread: ticket.id };
    const seen = old[ticket.id] !== undefined;
    // A run's end first, then what changed: "Review finished" comes before the Ready card.
    const roles = copyRuns(app, projectPath, ticket.id, seen);
    if (roles.length > 0) {
      ended.push({ id: ticket.id, roles });
      stopMoved(app, ref);
    }
    const entries = diffTicket(old[ticket.id], ticket, now());
    record(app, ref, entries);
    // The first look at a project would ring for every old ticket. The tree shows those.
    if (seen) notifyIfNeeded(app, ref, entries);
    const stop = seen && entries.find((e) => e.kind === 'needs-you');
    if (stop) explainStop(app, ref, stop.text);
  }
  const open = new Set(tickets.map((t) => t.id));
  for (const [id, view] of Object.entries(old)) {
    if (!open.has(id)) await closeTicket(app, projectPath, view);
  }
  offerGoneWorktrees(app, projectPath, tickets);
  store.views.write(projectPath, Object.fromEntries(tickets.map((t) => [t.id, t])));
  return ended;
}
