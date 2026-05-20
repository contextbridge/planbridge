import type { FrontendBrowser, TimeoutCancel } from '../FrontendBrowserImpl.ts';

export interface ScheduledFakeTimeout {
  readonly id: number;
  readonly delayMs: number;
  readonly handler: () => void;
}

export interface FakeBeforeUnloadEvent {
  readonly defaultPrevented: boolean;
  readonly returnValue: string;
}

export interface FakeFrontendBrowserOptions {
  readonly closeWindow?: () => void;
  readonly timers?: 'manual' | 'real';
}

export class FakeFrontendBrowser implements FrontendBrowser {
  readonly scheduledTimeouts: ScheduledFakeTimeout[] = [];
  readonly clearedTimeoutIds: number[] = [];
  readonly activeBeforeUnloadGuardIds: number[] = [];
  readonly removedBeforeUnloadGuardIds: number[] = [];

  closeWindowCallCount = 0;

  readonly #closeWindow: () => void;
  readonly #timers: 'manual' | 'real';
  #nextTimeoutId = 1;
  #nextBeforeUnloadGuardId = 1;

  constructor(options: FakeFrontendBrowserOptions = {}) {
    const { closeWindow = () => {}, timers = 'manual' } = options;
    this.#closeWindow = closeWindow;
    this.#timers = timers;
  }

  closeWindow(): void {
    this.closeWindowCallCount += 1;
    this.#closeWindow();
  }

  scheduleTimeout(handler: () => void, delayMs: number): TimeoutCancel {
    if (this.#timers === 'real') {
      const timeout = setTimeout(handler, delayMs);
      return () => {
        clearTimeout(timeout);
      };
    }

    const id = this.#nextTimeoutId;
    this.#nextTimeoutId += 1;
    this.scheduledTimeouts.push({ id, delayMs, handler });
    return () => {
      this.clearTimeout(id);
    };
  }

  addBeforeUnloadGuard(): () => void {
    const id = this.#nextBeforeUnloadGuardId;
    this.#nextBeforeUnloadGuardId += 1;
    this.activeBeforeUnloadGuardIds.push(id);
    return () => {
      this.#removeBeforeUnloadGuard(id);
    };
  }

  isBeforeUnloadGuarded(): boolean {
    return this.activeBeforeUnloadGuardIds.length > 0;
  }

  triggerBeforeUnload(): FakeBeforeUnloadEvent {
    const defaultPrevented = this.isBeforeUnloadGuarded();
    return {
      defaultPrevented,
      returnValue: defaultPrevented ? '' : 'unset',
    };
  }

  clearTimeout(timeoutId: number): void {
    this.clearedTimeoutIds.push(timeoutId);
    const index = this.scheduledTimeouts.findIndex((timeout) => timeout.id === timeoutId);
    if (index !== -1) {
      this.scheduledTimeouts.splice(index, 1);
    }
  }

  advance(): void {
    this.scheduledTimeouts.shift()?.handler();
  }

  runAllTimers(): void {
    while (this.scheduledTimeouts.length > 0) {
      this.advance();
    }
  }

  #removeBeforeUnloadGuard(id: number): void {
    this.removedBeforeUnloadGuardIds.push(id);
    const index = this.activeBeforeUnloadGuardIds.indexOf(id);
    if (index !== -1) {
      this.activeBeforeUnloadGuardIds.splice(index, 1);
    }
  }
}
