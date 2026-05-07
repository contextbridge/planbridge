import { describe, expect, it, vi } from 'vitest';
import type { ScheduleInterval } from './heartbeat.ts';
import { startHeartbeat } from './heartbeat.ts';

describe('startHeartbeat', () => {
  it('sends an immediate heartbeat on start', () => {
    const client = { sendHeartbeat: vi.fn().mockResolvedValue(undefined) };
    const stop = startHeartbeat(client, {
      addPageHideListener: () => () => {},
      scheduleInterval: () => () => {},
    });

    expect(client.sendHeartbeat).toHaveBeenCalledTimes(1);
    stop();
  });

  it('sends heartbeats at the configured interval', () => {
    const client = { sendHeartbeat: vi.fn().mockResolvedValue(undefined) };
    const interval = new FakeInterval();

    const stop = startHeartbeat(client, {
      intervalMs: 1_000,
      addPageHideListener: () => () => {},
      scheduleInterval: interval.fn,
    });

    expect(client.sendHeartbeat).toHaveBeenCalledTimes(1);

    interval.tick();
    expect(client.sendHeartbeat).toHaveBeenCalledTimes(2);

    interval.tick();
    expect(client.sendHeartbeat).toHaveBeenCalledTimes(3);

    stop();
  });

  it('stops sending heartbeats when the cleanup function is called', () => {
    const client = { sendHeartbeat: vi.fn().mockResolvedValue(undefined) };
    const interval = new FakeInterval();

    const stop = startHeartbeat(client, {
      intervalMs: 1_000,
      addPageHideListener: () => () => {},
      scheduleInterval: interval.fn,
    });

    stop();

    interval.tick();
    // Only the initial immediate heartbeat
    expect(client.sendHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('calls the page hide listener remover on cleanup', () => {
    const removeListener = vi.fn();
    const client = { sendHeartbeat: vi.fn().mockResolvedValue(undefined) };
    const stop = startHeartbeat(client, {
      addPageHideListener: () => removeListener,
      scheduleInterval: () => () => {},
    });

    stop();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it('clears the interval when the page hide callback fires', () => {
    const client = { sendHeartbeat: vi.fn().mockResolvedValue(undefined) };
    const interval = new FakeInterval();
    let hideCallback: (() => void) | null = null;

    const stop = startHeartbeat(client, {
      intervalMs: 1_000,
      addPageHideListener: (cb) => {
        hideCallback = cb;
        return () => {};
      },
      scheduleInterval: interval.fn,
    });

    expect(hideCallback).not.toBeNull();
    hideCallback!();

    interval.tick();
    // Only the initial immediate heartbeat — interval was cleared by pagehide
    expect(client.sendHeartbeat).toHaveBeenCalledTimes(1);
    stop();
  });
});

class FakeInterval {
  private handler: (() => void) | null = null;
  private cancelled = false;

  readonly fn: ScheduleInterval = (handler: () => void) => {
    this.handler = handler;
    this.cancelled = false;
    return () => {
      this.cancelled = true;
    };
  };

  tick(): void {
    if (!this.cancelled && this.handler) {
      this.handler();
    }
  }
}
