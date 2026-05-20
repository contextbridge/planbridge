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
});

interface RecordedTimeout {
  readonly id: number;
  readonly delayMs: number;
  readonly handler: () => void;
}

interface FakeBrowserWindow extends FrontendBrowserWindow {
  readonly scheduledTimeouts: RecordedTimeout[];
  readonly clearedTimeoutIds: number[];
  readonly closeCalls: number;
}

function createBrowserWindow(): FakeBrowserWindow {
  let closeCalls = 0;
  let nextTimeoutId = 1;
  const scheduledTimeouts: RecordedTimeout[] = [];
  const clearedTimeoutIds: number[] = [];

  return {
    get closeCalls() {
      return closeCalls;
    },
    scheduledTimeouts,
    clearedTimeoutIds,
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
  };
}
