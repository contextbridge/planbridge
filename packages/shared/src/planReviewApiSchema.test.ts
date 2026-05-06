import { describe, expect, it } from 'bun:test';
import { annotationThread, globalThread } from '@contextbridge/shared/testFactories';
import { NoContentSchema, PlanReviewApiRoutes } from './planReviewApiSchema.ts';

describe('PlanReviewApiRoutes', () => {
  it('defines the expected method/path pairs for all routes', () => {
    expect(PlanReviewApiRoutes.root).toMatchObject({ method: 'GET', path: '/' });
    expect(PlanReviewApiRoutes.config).toMatchObject({ method: 'GET', path: '/config' });
    expect(PlanReviewApiRoutes.payload).toMatchObject({ method: 'GET', path: '/payload' });
    expect(PlanReviewApiRoutes.updateNotice).toMatchObject({ method: 'GET', path: '/update-notice' });
    expect(PlanReviewApiRoutes.submit).toMatchObject({ method: 'POST', path: '/submit' });
    expect(PlanReviewApiRoutes.heartbeat).toMatchObject({ method: 'POST', path: '/heartbeat' });
  });

  it('config response schema parses a valid FrontendConfig', () => {
    const result = PlanReviewApiRoutes.config.response.safeParse({
      distinctId: 'user-123',
      telemetryDisabled: false,
    });
    expect(result.success).toBe(true);
  });

  it('payload response schema parses a valid SubmissionPayload', () => {
    const result = PlanReviewApiRoutes.payload.response.safeParse({
      content: '# Plan',
      metadata: { source: 'file' },
    });
    expect(result.success).toBe(true);
  });

  it('updateNotice response schema parses a valid UpdateNotice', () => {
    const result = PlanReviewApiRoutes.updateNotice.response.safeParse({
      currentVersion: '0.1.0',
      latestVersion: '0.2.0',
      channel: 'stable',
    });
    expect(result.success).toBe(true);
  });

  it('updateNotice response schema parses null', () => {
    const result = PlanReviewApiRoutes.updateNotice.response.safeParse(null);
    expect(result.success).toBe(true);
  });

  it('submit body schema accepts a valid PlanReviewSubmission', () => {
    const submission = {
      status: 'changes_requested',
      threads: [annotationThread.build(), globalThread.build()],
    };
    const result = PlanReviewApiRoutes.submit.body.safeParse(submission);
    expect(result.success).toBe(true);
  });

  it('submit body schema rejects invalid status values', () => {
    const invalid = { status: 'maybe', threads: [] };
    const result = PlanReviewApiRoutes.submit.body.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('NoContentSchema parses undefined', () => {
    const result = NoContentSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });
});
