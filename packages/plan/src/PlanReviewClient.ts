import type { FrontendConfig } from '@contextbridge/shared/frontendConfigSchema';
import { PlanReviewApiRoutes } from '@contextbridge/shared/planReviewApiSchema';
import type { PlanReviewSubmission, SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';

export type PlanReviewFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class PlanReviewClient {
  constructor(private readonly fetcher: PlanReviewFetch = fetch) {}

  async fetchConfig(): Promise<FrontendConfig | null> {
    try {
      const response = await this.fetcher(PlanReviewApiRoutes.config.path);
      if (!response.ok) return null;
      return PlanReviewApiRoutes.config.response.parse(await response.json());
    } catch {
      return null;
    }
  }

  async fetchPayload(): Promise<SubmissionPayload> {
    const response = await this.fetcher(PlanReviewApiRoutes.payload.path);
    return (await response.json()) as SubmissionPayload;
  }

  async fetchUpdateNotice(): Promise<UpdateNotice | null> {
    try {
      const response = await this.fetcher(PlanReviewApiRoutes.updateNotice.path);
      if (!response.ok) return null;
      const parsed = PlanReviewApiRoutes.updateNotice.response.safeParse(await response.json());
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async submitPlanReview(submission: PlanReviewSubmission): Promise<void> {
    const response = await this.fetcher(PlanReviewApiRoutes.submit.path, {
      method: PlanReviewApiRoutes.submit.method,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(submission),
    });

    if (response.ok) return;

    const body = (await response.text()).trim();
    if (body.length > 0) {
      throw new Error(body);
    }
    throw new Error(`submit failed with status ${response.status}`);
  }

  async sendHeartbeat(): Promise<void> {
    try {
      await this.fetcher(PlanReviewApiRoutes.heartbeat.path, {
        method: PlanReviewApiRoutes.heartbeat.method,
      });
    } catch {
      // Swallow errors — the server may already be closing after submit.
    }
  }
}
