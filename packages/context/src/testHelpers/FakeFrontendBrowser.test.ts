import { describe, expect, it } from 'bun:test';
import { FakeFrontendBrowser } from './FakeFrontendBrowser.ts';

describe('FakeFrontendBrowser', () => {
  it('records close calls and invokes the configured close callback', () => {
    let closed = false;
    const browser = new FakeFrontendBrowser({ closeWindow: () => (closed = true) });

    browser.closeWindow();

    expect(browser.closeWindowCallCount).toBe(1);
    expect(closed).toBe(true);
  });

  it('queues manual timers and advances them deterministically', () => {
    const browser = new FakeFrontendBrowser();
    let fired = false;

    browser.scheduleTimeout(() => {
      fired = true;
    }, 250);

    expect(browser.scheduledTimeouts).toMatchObject([{ id: 1, delayMs: 250 }]);
    expect(fired).toBe(false);

    browser.advance();

    expect(fired).toBe(true);
    expect(browser.scheduledTimeouts).toEqual([]);
  });

  it('cancels queued manual timers', () => {
    const browser = new FakeFrontendBrowser();
    let fired = false;

    const cancel = browser.scheduleTimeout(() => {
      fired = true;
    }, 250);
    cancel();
    browser.advance();

    expect(browser.clearedTimeoutIds).toEqual([1]);
    expect(fired).toBe(false);
  });

  it('records beforeunload guards and triggers fake prevented unload events', () => {
    const browser = new FakeFrontendBrowser();
    let attemptedUnloadCalls = 0;

    const cleanup = browser.addBeforeUnloadGuard({
      onAttemptedUnload: () => {
        attemptedUnloadCalls += 1;
      },
    });

    expect(browser.activeBeforeUnloadGuardIds).toEqual([1]);
    expect(browser.isBeforeUnloadGuarded()).toBe(true);
    expect(browser.triggerBeforeUnload()).toMatchObject({ defaultPrevented: true, returnValue: '' });
    expect(attemptedUnloadCalls).toBe(1);

    cleanup();

    expect(browser.removedBeforeUnloadGuardIds).toEqual([1]);
    expect(browser.isBeforeUnloadGuarded()).toBe(false);
    expect(browser.triggerBeforeUnload()).toMatchObject({ defaultPrevented: false, returnValue: 'unset' });
    expect(attemptedUnloadCalls).toBe(1);
  });
});
