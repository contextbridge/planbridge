import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import type { ServerContext } from './context.ts';

export interface ScheduledTimer {
  readonly handler: () => void;
  readonly delayMs: number;
  fire(): void;
}

export class FakeScheduleTimeout {
  readonly scheduled: ScheduledTimer[] = [];

  readonly fn = (handler: () => void, delayMs: number): (() => void) => {
    let cancelled = false;
    const timer: ScheduledTimer = {
      handler,
      delayMs,
      fire: () => {
        if (!cancelled) handler();
      },
    };
    this.scheduled.push(timer);
    return () => {
      cancelled = true;
    };
  };

  fireAll(): void {
    for (const timer of this.scheduled) {
      timer.fire();
    }
  }

  fireLast(): void {
    const last = this.scheduled.at(-1);
    if (last) last.fire();
  }
}

export function fakeServerContext(overrides: Partial<ServerContext> = {}): ServerContext {
  return {
    ...fakeBaseContext(),
    scheduleTimeout: () => () => {},
    ...overrides,
  };
}
