/// <reference lib="dom" />

export type TimeoutCancel = () => void;

export type ScheduleTimeout = (handler: () => void, delayMs: number) => TimeoutCancel;

export interface FrontendBrowser {
  closeWindow(): void;
  scheduleTimeout(handler: () => void, delayMs: number): TimeoutCancel;
  addBeforeUnloadGuard(): () => void;
}

export interface FrontendBrowserWindow {
  readonly close: () => void;
  readonly setTimeout: (handler: () => void, delayMs: number) => number;
  readonly clearTimeout: (timeoutId: number) => void;
  addEventListener(type: 'beforeunload', handler: (event: BeforeUnloadEvent) => void): void;
  removeEventListener(type: 'beforeunload', handler: (event: BeforeUnloadEvent) => void): void;
}

export class FrontendBrowserImpl implements FrontendBrowser {
  readonly #window: FrontendBrowserWindow;

  constructor(browserWindow: FrontendBrowserWindow = window) {
    this.#window = browserWindow;
  }

  closeWindow(): void {
    this.#window.close();
  }

  scheduleTimeout(handler: () => void, delayMs: number): TimeoutCancel {
    const timeoutId = this.#window.setTimeout(handler, delayMs);
    return () => {
      this.#window.clearTimeout(timeoutId);
    };
  }

  addBeforeUnloadGuard(): () => void {
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    this.#window.addEventListener('beforeunload', handler);
    return () => {
      this.#window.removeEventListener('beforeunload', handler);
    };
  }
}
