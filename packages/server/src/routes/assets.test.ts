import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import { annotationPayload, asset } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { withServer } from '#src/testHelpers.ts';

describe('GET /assets/:id', () => {
  const ctx = fakeBaseContext();
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngAsset = asset.build({
    id: 'abc123',
    originalPath: '/x.png',
    dataBase64: Buffer.from(pngBytes).toString('base64'),
  });

  it('serves bytes for a known asset id with the right headers', async () => {
    const payload = annotationPayload.build({ assets: [pngAsset] });

    await withServer(ctx, { payload }, async (running) => {
      const res = await fetch(`${running.url}/assets/abc123`);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(res.headers.get('cache-control')).toBe('no-store');
      expect(new Uint8Array(await res.arrayBuffer())).toEqual(pngBytes);
    });
  });

  it('returns 404 for an unknown asset id', async () => {
    const payload = annotationPayload.build({ assets: [pngAsset] });

    await withServer(ctx, { payload }, async (running) => {
      const res = await fetch(`${running.url}/assets/does-not-exist`);

      expect(res.status).toBe(404);
    });
  });

  it('returns 404 when the payload has no assets field', async () => {
    await withServer(ctx, { payload: annotationPayload.build() }, async (running) => {
      const res = await fetch(`${running.url}/assets/abc123`);

      expect(res.status).toBe(404);
    });
  });
});
