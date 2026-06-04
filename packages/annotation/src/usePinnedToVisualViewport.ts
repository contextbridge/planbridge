import { type RefObject, useEffect } from 'react';

/**
 * Keeps a `position: fixed` element pinned to the *visible* bottom of the
 * viewport on small screens.
 *
 * `position: fixed; bottom: 0` is anchored to the layout viewport, whose
 * bottom on mobile sits below the visible area while the browser's address
 * bar is expanded and below the on-screen keyboard while a field is focused.
 * The result is a composer that only becomes visible once the user scrolls to
 * the very bottom of the page — it does not read as "sticky". Tracking the
 * `VisualViewport` and translating the element up by the hidden offset keeps
 * it glued to the bottom of what the user can actually see.
 *
 * When `enabled` is false (the sidebar is docked into its own column on large
 * screens) the element is laid out statically and no transform is applied.
 */
export function usePinnedToVisualViewport(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !viewport) {
      node.style.transform = '';
      return;
    }

    const update = () => {
      const hidden = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      node.style.transform = hidden > 0 ? `translateY(-${hidden}px)` : '';
    };

    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      node.style.transform = '';
    };
  }, [enabled, ref]);
}
