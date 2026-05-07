import type { BaseContext } from '@contextbridge/context';

/**
 * Schedule a callback after `delayMs` milliseconds. Returns a cancel function
 * that clears the scheduled callback. Injected so tests can use a controllable
 * fake instead of real timers.
 */
export type ScheduleTimeout = (handler: () => void, delayMs: number) => () => void;

export interface ServerContext extends BaseContext {
  readonly scheduleTimeout: ScheduleTimeout;
}
