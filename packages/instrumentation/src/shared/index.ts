export interface Analytics {
  identify(distinctId: string, properties?: Record<string, unknown>): void;
  capture(event: string, properties?: Record<string, unknown>): void;
  register(properties: Record<string, unknown>): void;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface TelemetryUser {
  readonly id: string;
}

export interface Telemetry {
  setUser(user: TelemetryUser | null): void;
  captureException(err: unknown): void;
  flush(timeoutMs?: number): Promise<void>;
}

export function createNoopAnalytics(): Analytics {
  return {
    identify: () => {},
    capture: () => {},
    register: () => {},
    flush: () => Promise.resolve(),
    shutdown: () => Promise.resolve(),
  };
}

export function createNoopTelemetry(): Telemetry {
  return {
    setUser: () => {},
    captureException: () => {},
    flush: () => Promise.resolve(),
  };
}
