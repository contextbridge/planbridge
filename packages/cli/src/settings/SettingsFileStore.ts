import { join } from 'node:path';
import { configDir } from '@contextbridge/instrumentation/node';
import {
  CURRENT_SETTINGS_VERSION,
  type PersistedSettings,
  PersistedSettingsSchema,
  type Settings,
  type SettingsPatch,
  resolveSettings,
} from '@contextbridge/shared/settingsSchema';
import { type SettingsStore, SettingsStoreError } from '@contextbridge/shared/settingsStore';
import { isRecord } from '@contextbridge/shared/typeGuards';
import { Result, ResultAsync, err, ok, okAsync } from 'neverthrow';
import type { Logger } from 'pino';
import type { Environment } from '#src/environment.ts';

const SETTINGS_FILE = 'settings.json';

interface SettingsFileStoreOptions {
  readonly env: Pick<Environment, 'HOME' | 'XDG_CONFIG_HOME'>;
  readonly logger: Logger;
}

export class SettingsFileStore implements SettingsStore {
  readonly path: string;
  private readonly logger: Logger;

  constructor(options: SettingsFileStoreOptions) {
    const { env, logger } = options;

    this.path = resolveSettingsPath(env);
    this.logger = logger;
  }

  async read(): Promise<Result<Settings, SettingsStoreError>> {
    return this.readPersisted().map((persisted) => resolveSettings(persisted));
  }

  async patch(patch: SettingsPatch): Promise<Result<Settings, SettingsStoreError>> {
    return this.applyAndWrite(patch).mapErr((error) => {
      this.logger.warn({ err: error, path: this.path }, 'settings patch failed');
      return error;
    });
  }

  private applyAndWrite(patch: SettingsPatch): ResultAsync<Settings, SettingsStoreError> {
    return this.readPersisted().andThen((persisted) => {
      const current = persisted ?? { version: CURRENT_SETTINGS_VERSION };
      const updated = applyPatch(current, patch);

      // Sparse-file rule: a patch that changes nothing writes nothing — an
      // untouched (or absent) file stays exactly as it was.
      if (Bun.deepEquals(updated, current)) return okAsync(resolveSettings(updated));

      return this.writePersisted(updated).map(() => resolveSettings(updated));
    });
  }

  /** Resolves to `undefined` when no settings file exists. */
  private readPersisted(): ResultAsync<PersistedSettings | undefined, SettingsStoreError> {
    return ResultAsync.fromPromise(Bun.file(this.path).text(), (cause) => cause)
      .andThen((contents) => parsePersisted(this.path, contents))
      .orElse((cause) => {
        if (hasCode(cause, 'ENOENT')) return ok(undefined);
        if (cause instanceof SettingsStoreError) return err(cause);
        return err(new SettingsStoreError('filesystem', `could not read settings file at ${this.path}`, { cause }));
      });
  }

  private writePersisted(persisted: PersistedSettings): ResultAsync<void, SettingsStoreError> {
    const contents = `${JSON.stringify(persisted, null, 2)}\n`;
    return ResultAsync.fromPromise(
      Bun.write(this.path, contents),
      (cause) => new SettingsStoreError('filesystem', `could not write settings file at ${this.path}`, { cause }),
    ).map(() => undefined);
  }
}

export function resolveSettingsPath(
  env: Pick<Environment, 'HOME' | 'XDG_CONFIG_HOME'>,
  options: { homedir?: () => string } = {},
): string {
  return join(configDir(env, options), SETTINGS_FILE);
}

function parsePersisted(path: string, contents: string): Result<PersistedSettings, SettingsStoreError> {
  return Result.fromThrowable(
    () => JSON.parse(contents) as unknown,
    (cause) => new SettingsStoreError('conflict', `settings file at ${path} contains malformed JSON`, { cause }),
  )().andThen((raw) => {
    const parsed = PersistedSettingsSchema.safeParse(raw);
    if (!parsed.success) {
      return err(
        new SettingsStoreError('conflict', `settings file at ${path} is not a valid settings document`, {
          cause: parsed.error,
        }),
      );
    }
    return ok(parsed.data);
  });
}

function applyPatch(current: PersistedSettings, patch: SettingsPatch): PersistedSettings {
  const updated = { ...current };
  const ui = definedValues(patch.ui);
  if (ui) updated.ui = { ...updated.ui, ...ui };
  const claude = definedValues(patch.harnesses?.claude);
  if (claude) updated.harnesses = { ...updated.harnesses, claude: { ...updated.harnesses?.claude, ...claude } };
  return updated;
}

/** The section's explicitly-set values, or `undefined` when there are none. */
function definedValues<T extends Record<string, unknown>>(section: T | undefined): T | undefined {
  if (!section) return undefined;
  const entries = Object.entries(section).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as T;
}

function hasCode(value: unknown, code: string): boolean {
  return isRecord(value) && value.code === code;
}
