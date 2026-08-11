import assert from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveSettings } from '@contextbridge/shared/settingsSchema';
import { describe, expect, it } from 'bun:test';
import pino from 'pino';
import { environment } from '#src/testFactories.ts';
import { SettingsFileStore, resolveSettingsPath } from './SettingsFileStore.ts';

describe('resolveSettingsPath', () => {
  it('uses XDG_CONFIG_HOME when set to an absolute path', () => {
    expect(resolveSettingsPath(environment.build({ XDG_CONFIG_HOME: '/xdg', HOME: '/home/test' }))).toBe(
      '/xdg/contextbridge/settings.json',
    );
  });

  it('ignores a relative XDG_CONFIG_HOME', () => {
    expect(resolveSettingsPath(environment.build({ XDG_CONFIG_HOME: 'rel/dir', HOME: '/home/test' }))).toBe(
      '/home/test/.config/contextbridge/settings.json',
    );
  });

  it('falls back to ~/.config', () => {
    expect(resolveSettingsPath(environment.build({ XDG_CONFIG_HOME: undefined, HOME: '/home/test' }))).toBe(
      '/home/test/.config/contextbridge/settings.json',
    );
  });

  it('falls back to the OS home directory when HOME is unset or empty', () => {
    const homedir = () => '/os/home';
    for (const HOME of [undefined, '']) {
      expect(resolveSettingsPath(environment.build({ XDG_CONFIG_HOME: undefined, HOME }), { homedir })).toBe(
        '/os/home/.config/contextbridge/settings.json',
      );
    }
  });
});

describe('SettingsFileStore', () => {
  it('reads a missing file as defaults without creating it', async () => {
    await using root = tempConfigDir();
    const store = createStore(root.path);
    const result = await store.read();
    assert(result.isOk());
    expect(result.value).toEqual(resolveSettings());
    expect(existsSync(store.path)).toBe(false);
  });

  it('refuses to read a file with malformed JSON without rewriting it', async () => {
    await using root = tempConfigDir();
    const store = createStore(root.path);
    await seedSettingsFile(store, '{"version":');
    const result = await store.read();
    assert(result.isErr());
    expect(result.error.kind).toBe('conflict');
    expect(result.error.message).toContain(store.path);
    expect(readFileSync(store.path, 'utf8')).toBe('{"version":');
  });

  it('refuses to read an invalid settings document without rewriting it', async () => {
    await using root = tempConfigDir();
    const store = createStore(root.path);
    await seedSettingsFile(store, '{"version":1,"ui":{"theme":"not-a-theme"}}');
    const result = await store.read();
    assert(result.isErr());
    expect(result.error.kind).toBe('conflict');
    expect(result.error.message).toContain(store.path);
    expect(JSON.parse(readFileSync(store.path, 'utf8'))).toEqual({ version: 1, ui: { theme: 'not-a-theme' } });
  });

  it('writes a formatted sparse document', async () => {
    await using root = tempConfigDir();
    const store = createStore(root.path);
    const result = await store.patch({ ui: { theme: 'dracula' } });
    assert(result.isOk());
    expect(result.value.ui.theme).toBe('dracula');
    expect(readFileSync(store.path, 'utf8')).toBe('{\n  "version": 1,\n  "ui": {\n    "theme": "dracula"\n  }\n}\n');
  });

  it('updates an existing file in place', async () => {
    await using root = tempConfigDir();
    const store = createStore(root.path);
    await seedSettingsFile(store, '{"version":1,"ui":{"theme":"dracula"}}');
    const result = await store.patch({ ui: { theme: 'nord' } });
    assert(result.isOk());
    expect(result.value.ui.theme).toBe('nord');
    expect(JSON.parse(readFileSync(store.path, 'utf8'))).toEqual({ version: 1, ui: { theme: 'nord' } });
  });

  it('refuses to overwrite a file it does not understand', async () => {
    const invalidContents = [
      '{"version":',
      '{"ui":{"theme":"nord"}}',
      '{"version":1,"future":true}',
      '{"version":1,"ui":["not-an-object"]}',
    ];
    for (const contents of invalidContents) {
      await using root = tempConfigDir();
      const store = createStore(root.path);
      await seedSettingsFile(store, contents);
      const result = await store.patch({ ui: { theme: 'nord' } });
      assert(result.isErr());
      expect(result.error.kind).toBe('conflict');
      expect(readFileSync(store.path, 'utf8')).toBe(contents);
    }
  });

  it('does not create or touch the file for a patch that changes nothing', async () => {
    await using root = tempConfigDir();
    const store = createStore(root.path);
    for (const patch of [{}, { ui: {} }]) {
      const result = await store.patch(patch);
      assert(result.isOk());
      expect(result.value).toEqual(resolveSettings());
    }
    expect(existsSync(store.path)).toBe(false);

    await store.patch({ ui: { theme: 'dracula' } });
    const written = statSync(store.path);
    await store.patch({ ui: { theme: 'dracula' } });
    expect(statSync(store.path).mtimeMs).toBe(written.mtimeMs);
  });

  it('returns a filesystem error when the config root is unwritable', async () => {
    await using root = tempConfigDir();
    const store = createStore(root.path);
    await chmod(root.path, 0o500);
    const result = await store.patch({ ui: { theme: 'nord' } });
    await chmod(root.path, 0o700);
    assert(result.isErr());
    expect(result.error.kind).toBe('filesystem');
    expect(readdirSync(root.path)).toEqual([]);
  });
});

function tempConfigDir(): AsyncDisposable & { path: string } {
  const path = mkdtempSync(join(tmpdir(), 'contextbridge-settings-'));
  return {
    path,
    async [Symbol.asyncDispose]() {
      await chmod(path, 0o700).catch(() => {});
      await rm(path, { recursive: true, force: true });
    },
  };
}

function createStore(root: string): SettingsFileStore {
  return new SettingsFileStore({
    env: environment.build({ XDG_CONFIG_HOME: root }),
    logger: pino({ level: 'silent' }),
  });
}

/** Seeds raw pre-existing on-disk state, including states the store refuses to write. */
async function seedSettingsFile(store: SettingsFileStore, contents: string): Promise<void> {
  await mkdir(join(store.path, '..'), { recursive: true });
  await writeFile(store.path, contents);
}
