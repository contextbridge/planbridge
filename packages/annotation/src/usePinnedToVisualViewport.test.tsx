import { act } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { renderAnnotationHook } from './testHelpers/renderAnnotationHook.tsx';
import { usePinnedToVisualViewport } from './usePinnedToVisualViewport.ts';

describe('usePinnedToVisualViewport', () => {
  const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const originalInnerHeight = window.innerHeight;

  afterEach(() => {
    if (originalVisualViewport) {
      Object.defineProperty(window, 'visualViewport', originalVisualViewport);
    }
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight });
  });

  it('translates the element up by the height hidden behind mobile chrome', () => {
    stubViewport({ innerHeight: 800, viewportHeight: 600, offsetTop: 0 });
    const ref = createRef<HTMLDivElement>();
    const node = document.createElement('div');
    ref.current = node;

    renderAnnotationHook(() => usePinnedToVisualViewport(ref, true));

    expect(node.style.transform).toBe('translateY(-200px)');
  });

  it('does not transform the element when the sidebar is docked', () => {
    stubViewport({ innerHeight: 800, viewportHeight: 600, offsetTop: 0 });
    const ref = createRef<HTMLDivElement>();
    const node = document.createElement('div');
    node.style.transform = 'translateY(-50px)';
    ref.current = node;

    renderAnnotationHook(() => usePinnedToVisualViewport(ref, false));

    expect(node.style.transform).toBe('');
  });

  it('clears the transform once the viewport fully fills the layout', () => {
    const viewport = stubViewport({ innerHeight: 800, viewportHeight: 600, offsetTop: 0 });
    const ref = createRef<HTMLDivElement>();
    const node = document.createElement('div');
    ref.current = node;

    renderAnnotationHook(() => usePinnedToVisualViewport(ref, true));
    expect(node.style.transform).toBe('translateY(-200px)');

    act(() => {
      viewport.setHeight(800);
      viewport.fire('resize');
    });

    expect(node.style.transform).toBe('');
  });
});

function stubViewport({
  innerHeight,
  viewportHeight,
  offsetTop,
}: {
  innerHeight: number;
  viewportHeight: number;
  offsetTop: number;
}) {
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: innerHeight });

  const listeners = new Map<string, Set<() => void>>();
  const fakeViewport = {
    height: viewportHeight,
    offsetTop,
    addEventListener: (event: string, listener: () => void) => {
      const set = listeners.get(event) ?? new Set();
      set.add(listener);
      listeners.set(event, set);
    },
    removeEventListener: (event: string, listener: () => void) => {
      listeners.get(event)?.delete(listener);
    },
  };

  Object.defineProperty(window, 'visualViewport', { configurable: true, value: fakeViewport });

  return {
    setHeight: (height: number) => {
      fakeViewport.height = height;
    },
    fire: (event: string) => {
      for (const listener of listeners.get(event) ?? []) {
        listener();
      }
    },
  };
}
