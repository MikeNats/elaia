import type { ThreadRef } from '@/shared';

// Which thread the main panel shows once its page has loaded. The page loads again when the
// panel is new or was hidden (VS Code drops a hidden panel's page), and a message sent before
// it says `ready` is lost. So a focus waits for `ready` only then. A loaded panel shows it at
// once, and a later reload (a tab switch) does not jump back to it.
export function focusQueue(send: (ref: ThreadRef) => void) {
  let pending: ThreadRef | null = null;
  let loaded = false;
  return {
    focus: (ref: ThreadRef, visible: boolean) => {
      pending = loaded && visible ? null : ref;
      send(ref);
    },
    ready: () => {
      loaded = true;
      if (pending) send(pending);
      pending = null;
    },
    // The panel closed: the next one starts loading from nothing.
    reset: () => {
      loaded = false;
      pending = null;
    },
  };
}
