import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fromThrowable } from 'neverthrow';
import { type ConfigDirEnv, configDir } from './configDir.ts';

const FILE_NAME = 'anonymous_id';

export type AnonymousIdEnv = ConfigDirEnv;

const safeRead = fromThrowable((path: string) => readFileSync(path, 'utf8').trim());
const safeWrite = fromThrowable((dir: string, path: string, id: string) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, `${id}\n`, { encoding: 'utf8', mode: 0o600 });
});

export function getOrCreateAnonymousId(env: AnonymousIdEnv): string {
  const dir = configDir(env);
  const path = join(dir, FILE_NAME);

  const existing = safeRead(path).unwrapOr('');
  if (existing.length > 0) {
    return existing;
  }

  const id = crypto.randomUUID();
  // A read-only filesystem shouldn't break telemetry — discard the write
  // Result and return the generated id either way.
  safeWrite(dir, path, id);
  return id;
}
