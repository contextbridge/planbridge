import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startHeartbeat } from './heartbeat.ts';

describe('startHeartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends an immediate heartbeat on start', () => {
    const client = { sendHeartbeat: vi.fn().mockResolvedValue(undefined) };
    const stop = startHeartbeat(client, { addPageHideListener: () => () => {} });

    expect(client.sendHeartbeat).toHaveBeenCalledTimes(1);
    stop();
  });

  it('sends heartbeats at the configured interval', () => {
    const client = { sendHeartbeat: vi.fn().mockResolvedValue(undefined) };
    const stop = startHeartbeat(client, {
      intervalMs: 1_000,
      addPageHideListener: () => () => {},
    });

    expect(client.sendHeartbeat).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_000);
    expect(client.sendHeartbeat).toHaveBeenCalledTimes(2);

    vi.advanceTimersByTime(1_000);
    expect(client.sendHeartbeat).toHaveBeenCalledTimes(3);

    stop();
  });

  it('stops sending heartbeats when the cleanup function is called', () => {
    const client = { sendHeartbeat: vi.fn().mockResolvedValue(undefined) };
    const stop = startHeartbeat(client, {
      intervalMs: 1_000,
      addPageHideListener: () => () => {},
    });

    stop();

    vi.advanceTimersByTime(5_000);
    // Only the initial immediate heartbeat
    expect(client.sendHeartbeat).toHaveBeenCalledTimes(1);
  });

  it('calls the page hide listener remover on cleanup', () => {
    const removeListener = vi.fn();
    const client = { sendHeartbeat: vi.fn().mockResolvedValue(undefined) };
    const stop = startHeartbeat(client, {
      addPageHideListener: () => removeListener,
    });

    stop();
    expect(removeListener).toHaveBeenCalledTimes(1);
  });

  it('clears the interval when the page hide callback fires', () => {
    const client = { sendHeartbeat: vi.fn().mockResolvedValue(undefined) };
    let hideCallback: (() => void) | null = null;

    const stop = startHeartbeat(client, {
      intervalMs: 1_000,
      addPageHideListener: (cb) => {
        hideCallback = cb;
        return () => {};
      },
    });

    expect(hideCallback).not.toBeNull();
    hideCallback!();

    vi.advanceTimersByTime(5_000);
    // Only the initial immediate heartbeat — interval was cleared by pagehide
    expect(client.sendHeartbeat).toHaveBeenCalledTimes(1);
    stop();
  });
});
