import type { PropsWithChildren, ReactElement } from 'react';
import type { FrontendTelemetry } from '../shared/frontend.tsx';
import type { FakeTelemetry } from './index.ts';

export interface FakeFrontendTelemetry extends FrontendTelemetry, FakeTelemetry {}

export function createFakeFrontendTelemetry(): FakeFrontendTelemetry {
  const telemetry: FakeFrontendTelemetry = {
    exceptions: [],
    user: null,
    flushCount: 0,
    ErrorBoundary: PassthroughErrorBoundary,
    pinoTransmit: { level: 'silent', send: () => {} },
    setUser: (user) => {
      telemetry.user = user;
    },
    captureException: (err) => {
      telemetry.exceptions.push(err);
    },
    flush: () => {
      telemetry.flushCount += 1;
      return Promise.resolve();
    },
  };
  return telemetry;
}

function PassthroughErrorBoundary({ children }: PropsWithChildren): ReactElement {
  return <>{children}</>;
}
