import type { FakeIo } from './FakeIo.ts';

export function parseStdoutJson(io: FakeIo): unknown {
  return JSON.parse(io.stdout.text().trim());
}
