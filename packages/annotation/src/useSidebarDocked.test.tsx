import { act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderAnnotationHook } from './testHelpers/renderAnnotationHook.tsx';
import { SIDEBAR_DOCKED_QUERY, useSidebarDocked } from './useSidebarDocked.ts';

describe('useSidebarDocked', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('reports docked=true when the docked breakpoint matches', () => {
    stubMatchMedia(true);

    const { result } = renderAnnotationHook(() => useSidebarDocked());

    expect(result.current).toBe(true);
  });

  it('reports docked=false below the docked breakpoint', () => {
    stubMatchMedia(false);

    const { result } = renderAnnotationHook(() => useSidebarDocked());

    expect(result.current).toBe(false);
  });

  it('updates when the viewport crosses the breakpoint', () => {
    const { setMatches, fireChange } = stubMatchMedia(false);

    const { result } = renderAnnotationHook(() => useSidebarDocked());
    expect(result.current).toBe(false);

    act(() => {
      setMatches(true);
      fireChange();
    });

    expect(result.current).toBe(true);
  });

  it('queries the documented docked breakpoint', () => {
    const { mediaQueryList } = stubMatchMedia(true);

    renderAnnotationHook(() => useSidebarDocked());

    expect(mediaQueryList.media).toBe(SIDEBAR_DOCKED_QUERY);
  });
});

function stubMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mediaQueryList = {
    media: '',
    matches: initialMatches,
    addEventListener: (_event: string, listener: () => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_event: string, listener: () => void) => {
      listeners.delete(listener);
    },
  };

  window.matchMedia = (query: string) => {
    mediaQueryList.media = query;
    return mediaQueryList as unknown as MediaQueryList;
  };

  return {
    mediaQueryList,
    setMatches: (matches: boolean) => {
      mediaQueryList.matches = matches;
    },
    fireChange: () => {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}
