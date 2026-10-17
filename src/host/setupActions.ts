import type { ToHost } from '@/shared';
import type { MessageContext } from './messages';

// The setup and trust cards' buttons in a project's main chat. False: not one of those.
export async function setupAction(msg: ToHost, ctx: MessageContext): Promise<boolean> {
  const { app } = ctx;
  switch (msg.type) {
    case 'setup':
      await app.setup(msg.project);
      break;
    case 'skip-setup':
      app.skipSetup(msg.project);
      return true;
    case 'trust':
      await app.trust(msg.project, msg.hash);
      break;
    case 'not-trust':
      app.notNowTrust(msg.project);
      return true;
    case 'setup-step':
      await app.setupStep(msg.project, msg.step, msg.choice);
      break;
    default:
      return false;
  }
  ctx.projectsChanged();
  return true;
}
