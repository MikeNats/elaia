import type { ToHost } from '@/shared';

interface VsCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// Outside VS Code (tests, a plain browser) messages go nowhere instead of crashing.
const NO_HOST: VsCodeApi = {
  postMessage: () => undefined,
  getState: () => null,
  setState: () => undefined,
};

let api: VsCodeApi | null = null;

export function vscodeApi(): VsCodeApi {
  api ??= typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : NO_HOST;
  return api;
}

// Saved panel state holds several parts (open thread, column widths); each save keeps the rest.
export function saveState(part: Record<string, unknown>): void {
  const api = vscodeApi();
  api.setState({ ...(api.getState() as Record<string, unknown> | null), ...part });
}

export type Post = (message: ToHost) => void;

export const post: Post = (message) => vscodeApi().postMessage(message);
