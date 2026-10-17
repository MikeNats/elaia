import type { ThreadRef } from '@/shared';
import type { Post } from './host';
import { ProjectTree } from './ProjectTree';
import type { ViewState } from './state';
import { UsageBar } from './UsageBar';

// Moves the Elaia tab into its own window, or back. VS Code leaves the sidebar behind.
export function WindowLink({ own, post }: { own: boolean; post: Post }) {
  return (
    <button className="link window-link" onClick={() => post({ type: 'own-window', on: !own })}>
      {own ? '↩ Back to main window' : '⧉ Open in own window'}
    </button>
  );
}

// In its own window the tab has no sidebar, so it shows the tree itself.
export function OwnTree(p: { state: ViewState; select(ref: ThreadRef): void; post: Post }) {
  const { snapshot } = p.state;
  return (
    <aside className="column left own-tree">
      <UsageBar usage={snapshot.usage} post={p.post} />
      <ProjectTree
        projects={snapshot.projects}
        selected={p.state.selected}
        busy={snapshot.busy}
        attention={snapshot.attention}
        working={Object.keys(snapshot.agents ?? {})}
        post={p.post}
        onSelect={p.select}
      />
    </aside>
  );
}
