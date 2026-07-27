import { fakeBaseContext } from '@contextbridge/context/testHelpers';
import { annotationThread, globalThread } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'bun:test';
import { withServer } from '#src/testHelpers.ts';

describe('POST /submit', () => {
  const ctx = fakeBaseContext();

  it('resolves the result promise on a valid submission and sets connection: close', async () => {
    await withServer(ctx, async (running) => {
      const submission = {
        status: 'changes_requested' as const,
        threads: [annotationThread.build(), globalThread.build()],
        approvalMode: 'acceptEdits' as const,
      };

      const res = await fetch(`${running.url}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
      });

      expect(res.status).toBe(204);
      expect(res.headers.get('connection')).toBe('close');
      expect(await running.result).toEqual(submission);
    });
  });

  it('returns 400 when the submission fails schema validation', async () => {
    await withServer(ctx, async (running) => {
      const res = await fetch(`${running.url}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ status: 'maybe', threads: [] }),
      });

      expect(res.status).toBe(400);
    });
  });

  it('returns 400 when the request body is not valid JSON', async () => {
    await withServer(ctx, async (running) => {
      const res = await fetch(`${running.url}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      });

      expect(res.status).toBe(400);
    });
  });
});
