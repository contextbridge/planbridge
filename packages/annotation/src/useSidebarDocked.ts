import { useEffect, useState } from 'react';

/**
 * The comment sidebar docks into its own column at the `xl` breakpoint.
 * Below it, the sidebar stacks under the plan body and the composer is
 * pinned to the bottom of the viewport, so layout-dependent behavior
 * (auto-scroll, viewport pinning) keys off this query rather than the
 * static Tailwind breakpoint utilities.
 */
export const SIDEBAR_DOCKED_QUERY = '(min-width: 80rem)';

export function useSidebarDocked(): boolean {
  const [docked, setDocked] = useState(() => matchSidebarDocked());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const query = window.matchMedia(SIDEBAR_DOCKED_QUERY);
    const update = () => setDocked(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return docked;
}

function matchSidebarDocked(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }

  return window.matchMedia(SIDEBAR_DOCKED_QUERY).matches;
}
