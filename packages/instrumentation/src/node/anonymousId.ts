import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fromThrowable } from 'neverthrow';

const APP_DIR_NAME = 'contextbridge';
const FILE_NAME = 'anonymous_id';

export interface AnonymousIdEnv {
  readonly XDG_CONFIG_HOME?: string;
  readonly HOME?: string;
}

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

function configDir(env: AnonymousIdEnv): string {
  if (env.XDG_CONFIG_HOME && env.XDG_CONFIG_HOME.length > 0) {
    return join(env.XDG_CONFIG_HOME, APP_DIR_NAME);
  }
  const home = env.HOME && env.HOME.length > 0 ? env.HOME : homedir();
  return join(home, '.config', APP_DIR_NAME);
}
