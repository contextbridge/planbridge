import type { MemoryStream } from './index.ts';

export interface LogRecord {
  level: number;
  msg: string;
  [key: string]: unknown;
}

export function readLogs(stream: MemoryStream): LogRecord[] {
  return stream
    .text()
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as LogRecord);
}

export function readErrorLogs(stream: MemoryStream): LogRecord[] {
  return readLogs(stream).filter((r) => r.level === PINO_LEVEL_ERROR);
}

export function readWarnLogs(stream: MemoryStream): LogRecord[] {
  return readLogs(stream).filter((r) => r.level === PINO_LEVEL_WARN);
}

const PINO_LEVEL_WARN = 40;
const PINO_LEVEL_ERROR = 50;
