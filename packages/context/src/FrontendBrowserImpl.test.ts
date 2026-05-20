import { describe, expect, it } from 'bun:test';
import { FrontendBrowserImpl } from './FrontendBrowserImpl.ts';
import type { FrontendBrowserWindow } from './FrontendBrowserImpl.ts';

describe('FrontendBrowserImpl', () => {
  it('closes the injected window', () => {
    const browserWindow = createBrowserWindow();
    const browser = new FrontendBrowserImpl(browserWindow);

    browser.closeWindow();

    expect(browserWindow.closeCalls).toBe(1);
  });

  it('schedules timeout work through the injected window and returns a cancel callback', () => {
    const browserWindow = createBrowserWindow();
    const browser = new FrontendBrowserImpl(browserWindow);
    let fired = false;

    const cancel = browser.scheduleTimeout(() => {
      fired = true;
    }, 250);

    expect(browserWindow.scheduledTimeouts).toHaveLength(1);
    expect(browserWindow.scheduledTimeouts[0]?.delayMs).toBe(250);

    browserWindow.scheduledTimeouts[0]?.handler();
    expect(fired).toBe(true);

    cancel();
    expect(browserWindow.clearedTimeoutIds).toEqual([1]);
  });

  it('registers beforeunload guards through the injected window and returns a cleanup callback', () => {
    const browserWindow = createBrowserWindow();
    const browser = new FrontendBrowserImpl(browserWindow);

    const cleanup = browser.addBeforeUnloadGuard();

    const handler = browserWindow.beforeUnloadHandlers[0];
    if (!handler) {
      throw new Error('expected beforeunload handler to be registered');
    }

    const event = createBeforeUnloadEvent();
    handler(event);

    expect(event.defaultPrevented).toBe(true);
    expect(event.returnValue).toBe('');

    cleanup();

    expect(browserWindow.beforeUnloadHandlers).toEqual([]);
    expect(browserWindow.removedBeforeUnloadHandlers).toEqual([handler]);
  });
});

interface RecordedTimeout {
  readonly id: number;
  readonly delayMs: number;
  readonly handler: () => void;
}

interface FakeBrowserWindow extends FrontendBrowserWindow {
  readonly scheduledTimeouts: RecordedTimeout[];
  readonly clearedTimeoutIds: number[];
  readonly beforeUnloadHandlers: Array<(event: BeforeUnloadEvent) => void>;
  readonly removedBeforeUnloadHandlers: Array<(event: BeforeUnloadEvent) => void>;
  readonly closeCalls: number;
}

function createBrowserWindow(): FakeBrowserWindow {
  let closeCalls = 0;
  let nextTimeoutId = 1;
  const scheduledTimeouts: RecordedTimeout[] = [];
  const clearedTimeoutIds: number[] = [];
  const beforeUnloadHandlers: Array<(event: BeforeUnloadEvent) => void> = [];
  const removedBeforeUnloadHandlers: Array<(event: BeforeUnloadEvent) => void> = [];

  return {
    get closeCalls() {
      return closeCalls;
    },
    scheduledTimeouts,
    clearedTimeoutIds,
    beforeUnloadHandlers,
    removedBeforeUnloadHandlers,
    close: () => {
      closeCalls += 1;
    },
    setTimeout: (handler, delayMs) => {
      const id = nextTimeoutId;
      nextTimeoutId += 1;
      scheduledTimeouts.push({ id, handler, delayMs });
      return id;
    },
    clearTimeout: (timeoutId) => {
      clearedTimeoutIds.push(timeoutId);
    },
    addEventListener: (_type, handler) => {
      beforeUnloadHandlers.push(handler);
    },
    removeEventListener: (_type, handler) => {
      removedBeforeUnloadHandlers.push(handler);
      const index = beforeUnloadHandlers.indexOf(handler);
      if (index !== -1) {
        beforeUnloadHandlers.splice(index, 1);
      }
    },
  };
}

function createBeforeUnloadEvent(): BeforeUnloadEvent {
  let defaultPrevented = false;
  return {
    get defaultPrevented() {
      return defaultPrevented;
    },
    returnValue: 'unset',
    preventDefault: () => {
      defaultPrevented = true;
    },
  } as BeforeUnloadEvent;
}
