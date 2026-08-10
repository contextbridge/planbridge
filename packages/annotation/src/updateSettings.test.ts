import { describe, expect, it, vi } from 'vitest';
import { createUpdateSettings } from './updateSettings.ts';

describe('createUpdateSettings', () => {
  it('posts the patch to /settings as JSON and resolves true', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    const logger = { error: vi.fn() };

    await expect(createUpdateSettings({ logger, fetcher })({ ui: { theme: 'dracula' } })).resolves.toBe(true);

    expect(fetcher).toHaveBeenCalledExactlyOnceWith('/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ui: { theme: 'dracula' } }),
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('resolves false and reports the status, response body, and patch on a rejected patch', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{"error":"settings file cannot be safely updated"}', { status: 409 }));
    const logger = { error: vi.fn() };

    await expect(createUpdateSettings({ logger, fetcher })({ ui: { theme: 'nord' } })).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      {
        status: 409,
        body: '{"error":"settings file cannot be safely updated"}',
        patch: { ui: { theme: 'nord' } },
      },
      expect.any(String),
    );
  });

  it('resolves false and reports the cause and patch when the request itself fails', async () => {
    const failure = new TypeError('network down');
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(failure);
    const logger = { error: vi.fn() };

    await expect(createUpdateSettings({ logger, fetcher })({ ui: { theme: 'nord' } })).resolves.toBe(false);

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      { err: failure, patch: { ui: { theme: 'nord' } } },
      expect.any(String),
    );
  });
});
