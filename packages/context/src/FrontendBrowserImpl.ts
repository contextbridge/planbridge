/// <reference lib="dom" />

export type TimeoutCancel = () => void;

export type ScheduleTimeout = (handler: () => void, delayMs: number) => TimeoutCancel;

export interface FrontendBrowser {
  closeWindow(): void;
  scheduleTimeout(handler: () => void, delayMs: number): TimeoutCancel;
}

export interface FrontendBrowserWindow {
  readonly close: () => void;
  readonly setTimeout: (handler: () => void, delayMs: number) => number;
  readonly clearTimeout: (timeoutId: number) => void;
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
}
