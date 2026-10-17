import type { App } from '@/app';
import { ToHostSchema, type ThreadRef, type ToHost, type ToWebview } from '@/shared';
import { openReview } from './diff';
import { setupAction } from './setupActions';
import { vscodeAction } from './vscodeActions';

export interface MessageContext {
  app: App;
  post(message: ToWebview): void;
  // Projects were added or removed: the host re-syncs its file watchers.
  projectsChanged(): void;
  // The webview loaded and is listening. A focus asked for before that is sent now.
  ready(): void;
  // Opens (or brings back) the small chat panel for one ticket.
  showChat(ref: ThreadRef): void;
  // Shows this thread in the main panel (opening it if needed); the tree marks it.
  focusThread(ref: ThreadRef): void;
  // A page opened a thread: the tree marks it as the open one.
  opened(ref: ThreadRef): void;
  // Moves the Elaia tab into its own window, or back to the main window.
  ownWindow(on: boolean): Promise<void>;
}

async function route(msg: ToHost, ctx: MessageContext): Promise<void> {
  const { app } = ctx;
  if (await vscodeAction(msg, ctx)) return;
  if (await setupAction(msg, ctx)) return;
  switch (msg.type) {
    case 'ready':
      app.snapshot();
      return ctx.ready();
    case 'remove-project':
      app.removeProject(msg.project);
      return ctx.projectsChanged();
    case 'open-thread':
      ctx.opened({ project: msg.project, thread: msg.thread });
      return app.openThread(msg);
    case 'viewing':
      return app.viewing({ project: msg.project, thread: msg.thread }, msg.atBottom);
    case 'set-model':
      app.store.models.set({ project: msg.project, thread: msg.thread }, msg.model);
      return app.snapshot();
    case 'refresh-usage':
      return app.refreshUsage();
    case 'show-thread':
      return ctx.focusThread({ project: msg.project, thread: msg.thread });
    case 'send':
      return app.send(msg, msg.text);
    case 'stop':
      return app.stop(msg);
    case 'clear-chat':
      return app.clearChat(msg);
    case 'allow':
      return app.allow(msg, msg.tool);
    case 'advance':
      return app.advance(msg.project, msg.ticket);
    case 'push':
      return app.push({ project: msg.project, thread: msg.ticket });
    case 'merge':
      return app.merge({ project: msg.project, thread: msg.ticket });
    case 'close-ticket':
      return app.closeTicket({ project: msg.project, thread: msg.ticket });
    case 'cancel-ticket':
      return app.cancelTicket({ project: msg.project, thread: msg.ticket });
    case 'start-ticket':
      return app.startTicket({ project: msg.project, thread: msg.thread }, msg.ticket);
    case 'approve-epic':
      return app.approveEpic(msg.project, msg.epic, msg.approval);
    case 'drop-files':
      return app.saveInbox(msg.project, msg.files);
    case 'open-diff':
      return openReview(app, { project: msg.project, thread: msg.ticket }, ctx.showChat);
  }
}

// Every webview message is checked before anything acts on it: its shape and names by the
// schema, its project against the projects you added.
export async function handleMessage(raw: unknown, ctx: MessageContext): Promise<void> {
  const parsed = ToHostSchema.safeParse(raw);
  if (!parsed.success) {
    ctx.post({
      type: 'error',
      text: `Elaia got a message it does not understand: ${parsed.error.message.slice(0, 200)}`,
    });
    return;
  }
  const msg = parsed.data;
  if ('project' in msg && !ctx.app.store.projects.list().some((p) => p.path === msg.project)) {
    ctx.post({ type: 'error', text: `Elaia does not know the project ${msg.project}.` });
    return;
  }
  try {
    await route(msg, ctx);
  } catch (err) {
    ctx.post({ type: 'error', text: err instanceof Error ? err.message : String(err) });
  }
}
