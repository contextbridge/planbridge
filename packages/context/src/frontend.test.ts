import { describe, expect, it } from 'bun:test';
import pino from 'pino';
import { createFrontendContext } from './frontend.ts';
import { buildInfo } from './testFactories.ts';

describe('createFrontendContext', () => {
  const config = {
    distinctId: 'test-distinct-id',
    telemetryDisabled: true,
  };

  it('exposes browser lifecycle defaults through a browser adapter', () => {
    const ctx = createFrontendContext({
      config,
      surface: 'test',
      buildInfo: buildInfo.build(),
      logger: pino({ level: 'silent' }),
    });

    expect(typeof ctx.browser.closeWindow).toBe('function');
    expect(typeof ctx.browser.scheduleTimeout).toBe('function');
    expect(typeof ctx.browser.addBeforeUnloadGuard).toBe('function');
    expect('closeWindow' in ctx).toBe(false);
    expect('scheduleTimeout' in ctx).toBe(false);
  });

  it('applies browser overrides over the defaults', () => {
    let closed = false;
    let guarded = false;
    const ctx = createFrontendContext({
      config,
      surface: 'test',
      buildInfo: buildInfo.build(),
      logger: pino({ level: 'silent' }),
      browser: {
        closeWindow: () => {
          closed = true;
        },
        addBeforeUnloadGuard: () => {
          guarded = true;
          return () => {};
        },
      },
    });

    ctx.browser.closeWindow();
    ctx.browser.addBeforeUnloadGuard(() => {});

    expect(closed).toBe(true);
    expect(guarded).toBe(true);
    expect(typeof ctx.browser.scheduleTimeout).toBe('function');
  });
});
