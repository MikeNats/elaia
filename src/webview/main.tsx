import { createRoot } from 'react-dom/client';
import type { ThreadRef } from '@/shared';
import { App } from './App';
import { ThreadView } from './ThreadView';
import { TreeApp } from './TreeApp';
import './styles.css';
import './parts.css';
import './messages.css';

// One bundle for the main panel, a ticket chat panel and the sidebar tree; the host says which.
const root = document.getElementById('root');
const thread = root?.dataset.thread ? (JSON.parse(root.dataset.thread) as ThreadRef) : null;
const page = thread ? (
  <ThreadView threadRef={thread} />
) : root?.dataset.mode === 'tree' ? (
  <TreeApp />
) : (
  <App />
);
if (root) createRoot(root).render(page);
