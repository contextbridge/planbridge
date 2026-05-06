import { describe, expect, it, vi } from 'vitest';
import { PlanReviewClient } from './PlanReviewClient.ts';

describe('PlanReviewClient', () => {
  describe('fetchConfig', () => {
    it('returns a parsed FrontendConfig on success', async () => {
      const config = { distinctId: 'user-123', telemetryDisabled: false };
      const fakeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(config)));

      const client = new PlanReviewClient(fakeFetch);
      const result = await client.fetchConfig();

      expect(result).toEqual(config);
      expect(fakeFetch).toHaveBeenCalledWith('/config');
    });

    it('returns null when the response is not ok', async () => {
      const fakeFetch = vi.fn().mockResolvedValue(new Response('not found', { status: 404 }));

      const client = new PlanReviewClient(fakeFetch);
      const result = await client.fetchConfig();

      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      const fakeFetch = vi.fn().mockRejectedValue(new Error('network error'));

      const client = new PlanReviewClient(fakeFetch);
      const result = await client.fetchConfig();

      expect(result).toBeNull();
    });
  });

  describe('fetchPayload', () => {
    it('returns the payload JSON', async () => {
      const payload = { content: '# Plan', metadata: { source: 'file' } };
      const fakeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(payload)));

      const client = new PlanReviewClient(fakeFetch);
      const result = await client.fetchPayload();

      expect(result).toEqual(payload);
      expect(fakeFetch).toHaveBeenCalledWith('/payload');
    });
  });

  describe('fetchUpdateNotice', () => {
    it('returns a parsed UpdateNotice on success', async () => {
      const notice = { currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' };
      const fakeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(notice)));

      const client = new PlanReviewClient(fakeFetch);
      const result = await client.fetchUpdateNotice();

      expect(result).toEqual(notice);
      expect(fakeFetch).toHaveBeenCalledWith('/update-notice');
    });

    it('returns null when the response is not ok', async () => {
      const fakeFetch = vi.fn().mockResolvedValue(new Response('error', { status: 500 }));

      const client = new PlanReviewClient(fakeFetch);
      const result = await client.fetchUpdateNotice();

      expect(result).toBeNull();
    });

    it('returns null when parsing fails', async () => {
      const fakeFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ invalid: true })));

      const client = new PlanReviewClient(fakeFetch);
      const result = await client.fetchUpdateNotice();

      expect(result).toBeNull();
    });

    it('returns null when fetch throws', async () => {
      const fakeFetch = vi.fn().mockRejectedValue(new Error('network error'));

      const client = new PlanReviewClient(fakeFetch);
      const result = await client.fetchUpdateNotice();

      expect(result).toBeNull();
    });
  });

  describe('submitPlanReview', () => {
    it('sends the submission as a POST with JSON body', async () => {
      const fakeFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
      const submission = { status: 'approved' as const, threads: [] };

      const client = new PlanReviewClient(fakeFetch);
      await client.submitPlanReview(submission);

      expect(fakeFetch).toHaveBeenCalledWith('/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submission),
      });
    });

    it('throws with the response body text on non-ok response', async () => {
      const fakeFetch = vi.fn().mockResolvedValue(new Response('invalid submission', { status: 400 }));
      const submission = { status: 'approved' as const, threads: [] };

      const client = new PlanReviewClient(fakeFetch);
      await expect(client.submitPlanReview(submission)).rejects.toThrow('invalid submission');
    });

    it('throws with a generic message when the body is empty', async () => {
      const fakeFetch = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
      const submission = { status: 'approved' as const, threads: [] };

      const client = new PlanReviewClient(fakeFetch);
      await expect(client.submitPlanReview(submission)).rejects.toThrow('submit failed with status 500');
    });
  });

  describe('sendHeartbeat', () => {
    it('sends a POST to /heartbeat', async () => {
      const fakeFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

      const client = new PlanReviewClient(fakeFetch);
      await client.sendHeartbeat();

      expect(fakeFetch).toHaveBeenCalledWith('/heartbeat', { method: 'POST' });
    });

    it('swallows errors silently', async () => {
      const fakeFetch = vi.fn().mockRejectedValue(new Error('connection refused'));

      const client = new PlanReviewClient(fakeFetch);
      // Should not throw
      await client.sendHeartbeat();
    });
  });
});
