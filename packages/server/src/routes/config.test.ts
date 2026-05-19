import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import { frontendConfig } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { withServer } from '#src/testHelpers.ts';

describe('GET /config', () => {
  const ctx = fakeBaseContext();

  it('serves the frontend config as JSON', async () => {
    const config = frontendConfig.build();
    await withServer(ctx, { config }, async (running) => {
      const res = await fetch(`${running.url}/config`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(config);
    });
  });
});
