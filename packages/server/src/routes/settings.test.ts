import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import { SettingsStoreError } from '@contextbridge/shared/settingsStore';
import { settings } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { err, ok } from 'neverthrow';
import { withServer } from '#src/testHelpers.ts';

describe('POST /settings', () => {
  const ctx = fakeBaseContext();

  it('forwards the parsed patch to the store and returns newly resolved settings', async () => {
    const received: unknown[] = [];
    const resolved = settings.build({ ui: { theme: 'nord' } });
    await withServer(
      ctx,
      {
        updateSettings: (patch) => {
          received.push(patch);
          return Promise.resolve(ok(resolved));
        },
      },
      async (running) => {
        const response = await fetch(`${running.url}/settings`, request({ ui: { theme: 'nord' } }));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(resolved);
        expect(received).toEqual([{ ui: { theme: 'nord' } }]);
      },
    );
  });

  it('forwards a harness patch to the store and returns newly resolved settings', async () => {
    const received: unknown[] = [];
    const resolved = settings.build({ harnesses: { claude: { planApprovalMode: 'default' } } });
    await withServer(
      ctx,
      {
        updateSettings: (patch) => {
          received.push(patch);
          return Promise.resolve(ok(resolved));
        },
      },
      async (running) => {
        const patch = { harnesses: { claude: { planApprovalMode: 'default' } } };
        const response = await fetch(`${running.url}/settings`, request(patch));
        expect(response.status).toBe(200);
        expect(await response.json()).toEqual(resolved);
        expect(received).toEqual([patch]);
      },
    );
  });

  it('returns 400 for malformed JSON and invalid patches', async () => {
    await withServer(ctx, async (running) => {
      const malformed = await fetch(`${running.url}/settings`, requestBody('{'));
      const unknown = await fetch(`${running.url}/settings`, request({ unknown: true }));
      expect([malformed.status, unknown.status]).toEqual([400, 400]);
    });
  });

  it('maps conflict and filesystem failures to 409 and 500', async () => {
    for (const [kind, expected] of [
      ['conflict', 409],
      ['filesystem', 500],
    ] as const) {
      await withServer(
        ctx,
        { updateSettings: () => Promise.resolve(err(new SettingsStoreError(kind, 'nope'))) },
        async (running) => {
          const response = await fetch(`${running.url}/settings`, request({ ui: { theme: 'nord' } }));
          expect(response.status).toBe(expected);
        },
      );
    }
  });
});

function request(body: unknown): RequestInit {
  return requestBody(JSON.stringify(body));
}

function requestBody(body: string): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body };
}
