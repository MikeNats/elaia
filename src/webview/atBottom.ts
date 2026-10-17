import { useEffect, type RefObject } from 'react';
import type { ThreadRef } from '@/shared';
import type { Post } from './host';

// Tells the host when the thread's last message is on screen: then you have seen it all,
// and its blue dot goes. Leaving the bottom, or hiding the page, says so too.
export function useAtBottom(end: RefObject<HTMLDivElement | null>, ref: ThreadRef, post: Post) {
  const { project, thread } = ref;
  useEffect(() => {
    const target = end.current;
    if (!target || typeof IntersectionObserver === 'undefined') return;
    const say = (atBottom: boolean) => post({ type: 'viewing', project, thread, atBottom });
    const watch = new IntersectionObserver(([seen]) => say(Boolean(seen?.isIntersecting)));
    watch.observe(target);
    const onHide = () => say(document.visibilityState === 'visible' && isOnScreen(target));
    document.addEventListener('visibilitychange', onHide);
    return () => {
      watch.disconnect();
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [end, project, thread, post]);
}

function isOnScreen(el: HTMLElement): boolean {
  const box = el.getBoundingClientRect();
  return box.top < window.innerHeight && box.bottom >= 0;
}
