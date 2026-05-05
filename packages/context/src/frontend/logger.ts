import pino, { type LevelWithSilent, type LogEvent, type Logger } from 'pino';

export type { Logger, LevelWithSilent, LogEvent };

export interface BrowserPinoTransmit {
  readonly level: LevelWithSilent;
  readonly send: (level: string, logEvent: LogEvent) => void;
}

export interface BrowserLoggerOptions {
  readonly level?: LevelWithSilent;
  readonly transmit?: BrowserPinoTransmit;
}

export function createLogger({ level = 'info', transmit }: BrowserLoggerOptions = {}): Logger {
  return pino({
    level,
    browser: {
      asObject: true,
      ...(transmit ? { transmit } : {}),
    },
  });
}
