import assert from 'node:assert';
import { existsSync, mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveSettings } from '@contextbridge/shared/settingsSchema';
import { afterEach, describe, expect, it } from 'bun:test';
import pino from 'pino';
import { environment } from '#src/testFactories.ts';
import { SettingsStoreImpl, resolveSettingsPath } from './SettingsStoreImpl.ts';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map(async (path) => {
      await chmod(path, 0o700).catch(() => {});
      await rm(path, { recursive: true, force: true });
    }),
  );
});

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

describe('SettingsStoreImpl', () => {
  it('reads a missing file as defaults without creating it', async () => {
    const store = createStore();
    expect(await store.read()).toEqual(resolveSettings());
    expect(existsSync(store.path)).toBe(false);
  });

  it('reads a file with malformed JSON as defaults without rewriting it', async () => {
    const store = createStore();
    await writeSettings(store, '{"version":');
    expect(await store.read()).toEqual(resolveSettings());
    expect(readFileSync(store.path, 'utf8')).toBe('{"version":');
  });

  it('reads an invalid settings document as defaults without rewriting it', async () => {
    const store = createStore();
    await writeSettings(store, '{"version":1,"ui":{"theme":"not-a-theme"}}');
    expect(await store.read()).toEqual(resolveSettings());
    expect(JSON.parse(readFileSync(store.path, 'utf8'))).toEqual({ version: 1, ui: { theme: 'not-a-theme' } });
  });

  it('writes a formatted sparse document', async () => {
    const store = createStore();
    const result = await store.patch({ ui: { theme: 'dracula' } });
    assert(result.isOk());
    expect(result.value.ui.theme).toBe('dracula');
    expect(readFileSync(store.path, 'utf8')).toBe('{\n  "version": 1,\n  "ui": {\n    "theme": "dracula"\n  }\n}\n');
  });

  it('updates an existing file in place', async () => {
    const store = createStore();
    await writeSettings(store, '{"version":1,"ui":{"theme":"dracula"}}');
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
      const store = createStore();
      await writeSettings(store, contents);
      const result = await store.patch({ ui: { theme: 'nord' } });
      assert(result.isErr());
      expect(result.error.kind).toBe('conflict');
      expect(readFileSync(store.path, 'utf8')).toBe(contents);
    }
  });

  it('does not create or touch the file for a patch that changes nothing', async () => {
    const store = createStore();
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
    const store = createStore();
    const root = join(store.path, '..', '..');
    await chmod(root, 0o500);
    const result = await store.patch({ ui: { theme: 'nord' } });
    await chmod(root, 0o700);
    assert(result.isErr());
    expect(result.error.kind).toBe('filesystem');
    expect(readdirSync(root)).toEqual([]);
  });
});

function createStore(): SettingsStoreImpl {
  const root = mkdtempSync(join(tmpdir(), 'contextbridge-settings-'));
  temporaryDirectories.push(root);
  return new SettingsStoreImpl({
    env: environment.build({ XDG_CONFIG_HOME: root }),
    logger: pino({ level: 'silent' }),
  });
}

async function writeSettings(store: SettingsStoreImpl, contents: string): Promise<void> {
  await mkdir(join(store.path, '..'), { recursive: true });
  await writeFile(store.path, contents);
}
