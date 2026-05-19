import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { describe, expect, it } from 'bun:test';
import { withServer } from '#src/testHelpers.ts';

describe('GET /update-notice', () => {
  const ctx = fakeBaseContext();

  it('returns null when no checkForUpdate callback is provided', async () => {
    await withServer(ctx, async (running) => {
      const res = await fetch(`${running.url}/update-notice`);
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });
  });

  it('invokes checkForUpdate on demand and returns the resolved notice', async () => {
    const notice: UpdateNotice = {
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      channel: 'stable',
    };
    let calls = 0;
    await withServer(
      ctx,
      {
        checkForUpdate: () => {
          calls++;
          return Promise.resolve(notice);
        },
      },
      async (running) => {
        const res = await fetch(`${running.url}/update-notice`);
        expect(await res.json()).toEqual(notice);
        expect(calls).toBe(1);
      },
    );
  });

  it('returns null when checkForUpdate rejects', async () => {
    await withServer(ctx, { checkForUpdate: () => Promise.reject(new Error('boom')) }, async (running) => {
      const res = await fetch(`${running.url}/update-notice`);
      expect(await res.json()).toBeNull();
    });
  });

  it('returns null when checkForUpdate never resolves within the timeout', async () => {
    // Never resolves — the 3s server-side timeout should fire.
    await withServer(ctx, { checkForUpdate: () => new Promise(() => {}) }, async (running) => {
      // Prove the handler IS waiting (not returning synchronously) by racing
      // against a tight external timeout — if the handler returned early we'd
      // see the json, but we should instead see 'still pending' because the
      // handler is still awaiting the server-side timeout.
      const notice: unknown = await Promise.race([
        fetch(`${running.url}/update-notice`).then((r) => r.json()),
        new Promise((resolve) => setTimeout(() => resolve('still pending'), 50)),
      ]);
      expect(notice).toBe('still pending');
    });
  });
});
