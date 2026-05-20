import type { BeforeUnloadGuardOptions, FrontendBrowser, TimeoutCancel } from '../FrontendBrowserImpl.ts';

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

interface ActiveBeforeUnloadGuard {
  readonly id: number;
  readonly onAttemptedUnload: (() => void) | undefined;
}

export class FakeFrontendBrowser implements FrontendBrowser {
  readonly scheduledTimeouts: ScheduledFakeTimeout[] = [];
  readonly clearedTimeoutIds: number[] = [];
  readonly activeBeforeUnloadGuardIds: number[] = [];
  readonly removedBeforeUnloadGuardIds: number[] = [];

  closeWindowCallCount = 0;

  readonly #closeWindow: () => void;
  readonly #timers: 'manual' | 'real';
  readonly #beforeUnloadGuards: ActiveBeforeUnloadGuard[] = [];
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

  addBeforeUnloadGuard(options: BeforeUnloadGuardOptions = {}): () => void {
    const { onAttemptedUnload } = options;
    const id = this.#nextBeforeUnloadGuardId;
    this.#nextBeforeUnloadGuardId += 1;
    this.activeBeforeUnloadGuardIds.push(id);
    this.#beforeUnloadGuards.push({ id, onAttemptedUnload });
    return () => {
      this.#removeBeforeUnloadGuard(id);
    };
  }

  isBeforeUnloadGuarded(): boolean {
    return this.activeBeforeUnloadGuardIds.length > 0;
  }

  triggerBeforeUnload(): FakeBeforeUnloadEvent {
    const defaultPrevented = this.isBeforeUnloadGuarded();
    if (defaultPrevented) {
      for (const guard of this.#beforeUnloadGuards) {
        guard.onAttemptedUnload?.();
      }
    }

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

    const guardIndex = this.#beforeUnloadGuards.findIndex((guard) => guard.id === id);
    if (guardIndex !== -1) {
      this.#beforeUnloadGuards.splice(guardIndex, 1);
    }
  }
}
