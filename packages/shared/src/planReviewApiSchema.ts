import { z } from 'zod';
import { FrontendConfigSchema } from './frontendConfigSchema.ts';
import { PlanReviewSubmissionSchema, SubmissionPayloadSchema } from './planReviewSchema.ts';
import { UpdateNoticeSchema } from './updateNoticeSchema.ts';

export const NoContentSchema = z.void();
export type NoContent = z.infer<typeof NoContentSchema>;

export const PlanReviewApiRoutes = {
  root: {
    method: 'GET',
    path: '/',
    response: z.string(),
  },
  config: {
    method: 'GET',
    path: '/config',
    response: FrontendConfigSchema,
  },
  payload: {
    method: 'GET',
    path: '/payload',
    response: SubmissionPayloadSchema,
  },
  updateNotice: {
    method: 'GET',
    path: '/update-notice',
    response: UpdateNoticeSchema.nullable(),
  },
  submit: {
    method: 'POST',
    path: '/submit',
    body: PlanReviewSubmissionSchema,
    response: NoContentSchema,
  },
  heartbeat: {
    method: 'POST',
    path: '/heartbeat',
    response: NoContentSchema,
  },
} as const;

export type PlanReviewApiRouteName = keyof typeof PlanReviewApiRoutes;
