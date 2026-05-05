import { describe, expect, it } from 'bun:test';
import { createFakeFrontendTelemetry } from './frontend.tsx';

describe('createFakeFrontendTelemetry', () => {
  it('records telemetry state', () => {
    const telemetry = createFakeFrontendTelemetry();
    telemetry.setUser({ id: 'user-1' });
    telemetry.captureException(new Error('boom'));

    expect(telemetry.user).toEqual({ id: 'user-1' });
    expect(telemetry.exceptions).toHaveLength(1);
  });

  it('exposes a passthrough ErrorBoundary', () => {
    const { ErrorBoundary } = createFakeFrontendTelemetry();
    expect(typeof ErrorBoundary).toBe('function');
  });
});
