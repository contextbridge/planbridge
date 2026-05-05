import { describe, expect, it } from 'bun:test';
import { createNoopFrontendTelemetry } from './frontend.tsx';

describe('createNoopFrontendTelemetry', () => {
  it('exposes the base Telemetry surface', async () => {
    const telemetry = createNoopFrontendTelemetry();
    expect(() => telemetry.setUser({ id: 'user-1' })).not.toThrow();
    expect(() => telemetry.captureException(new Error('boom'))).not.toThrow();
    expect(await telemetry.flush()).toBeUndefined();
  });

  it('provides an ErrorBoundary component', () => {
    const { ErrorBoundary } = createNoopFrontendTelemetry();
    expect(typeof ErrorBoundary).toBe('function');
  });
});
