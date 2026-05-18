import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import { annotationPayload } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { withServer } from '#src/testHelpers.ts';

describe('GET /payload', () => {
  const ctx = fakeBaseContext();

  it('serves the submission payload as JSON', async () => {
    const payload = annotationPayload.build();
    await withServer(ctx, { payload }, async (running) => {
      const res = await fetch(`${running.url}/payload`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(payload);
    });
  });
});
