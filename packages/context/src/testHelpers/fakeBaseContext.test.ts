import { describe, expect, it } from 'bun:test';
import { buildInfo } from '../testFactories.ts';
import { fakeBaseContext } from './fakeBaseContext.ts';
import { fakeFrontendContext } from './fakeFrontendContext.ts';

describe('fakeBaseContext', () => {
  it('returns a BaseContext with test defaults, silent logger, and fake instrumentation', () => {
    const ctx = fakeBaseContext();
    expect(ctx.buildInfo.version).toBe('test');
    expect(ctx.buildInfo.environment).toBe('local');
    expect(ctx.distinctId).toBe('fake-distinct-id');
    expect(ctx.telemetryDisabled).toBe(true);
    expect(typeof ctx.logger.info).toBe('function');
    expect(typeof ctx.analytics.capture).toBe('function');
    expect(typeof ctx.telemetry.captureException).toBe('function');
  });

  it('applies overrides over the defaults', () => {
    const ctx = fakeBaseContext({ buildInfo: buildInfo.build({ version: '9.9.9', environment: 'production' }) });
    expect(ctx.buildInfo.version).toBe('9.9.9');
    expect(ctx.buildInfo.environment).toBe('production');
  });
});

describe('fakeFrontendContext', () => {
  it('returns a FrontendContext with no-op browser hooks and a passthrough ErrorBoundary', () => {
    const ctx = fakeFrontendContext();
    expect(ctx.buildInfo.version).toBe('test');
    expect(typeof ctx.browser.closeWindow).toBe('function');
    expect(typeof ctx.browser.scheduleTimeout).toBe('function');
    expect(typeof ctx.browser.addBeforeUnloadGuard).toBe('function');
    expect(typeof ctx.telemetry.ErrorBoundary).toBe('function');
  });

  it('applies overrides', () => {
    let closed = false;
    const browser = fakeFrontendContext().browser;
    const ctx = fakeFrontendContext({ browser: { ...browser, closeWindow: () => (closed = true) } });
    ctx.browser.closeWindow();
    expect(closed).toBe(true);
  });
});
