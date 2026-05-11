import type { ScheduleTimeout } from '@contextbridge/context/frontend';
import {
  type FakeAnalytics,
  type FakeFrontendTelemetry,
  fakeFrontendContext,
} from '@contextbridge/context/testHelpers';
import type { PerformUpdateResult } from '@contextbridge/shared/performUpdateResultSchema';
import type { PlanReviewSubmission, SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { Mock } from 'vitest';
import { vi } from 'vitest';
import type { PlanAppContext } from '../useAppContext.ts';

export interface AutoCloseTimers {
  scheduleTimeout: ScheduleTimeout;
  closeWindow: Mock<() => void>;
  advance: () => void;
  lastCancel: () => Mock<() => void> | undefined;
}

export interface FakeAppContextResult {
  context: PlanAppContext;
  timers: AutoCloseTimers;
  submitPlanReview: Mock<(submission: PlanReviewSubmission) => Promise<void>>;
  fetchPayload: Mock<() => Promise<SubmissionPayload>>;
  fetchUpdateNotice: Mock<() => Promise<UpdateNotice | null>>;
  performUpdate: Mock<() => Promise<PerformUpdateResult>>;
  analytics: FakeAnalytics;
  telemetry: FakeFrontendTelemetry;
}

export function createFakeAppContext(overrides?: Partial<PlanAppContext>): FakeAppContextResult {
  const timers = createAutoCloseTimers();
  const submitPlanReview = vi.fn<(submission: PlanReviewSubmission) => Promise<void>>().mockResolvedValue(undefined);
  const fetchPayload = vi.fn<() => Promise<SubmissionPayload>>().mockResolvedValue({ content: '' });
  const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(null);
  const performUpdate = vi
    .fn<() => Promise<PerformUpdateResult>>()
    .mockResolvedValue({ status: 'success', message: 'Updated.' });
  const context: PlanAppContext = {
    ...fakeFrontendContext({
      scheduleTimeout: timers.scheduleTimeout,
      closeWindow: timers.closeWindow,
    }),
    fetchPayload,
    fetchUpdateNotice,
    performUpdate,
    submitPlanReview,
    autoCloseDelaySeconds: 3,
    ...overrides,
  };
  return {
    context,
    timers,
    submitPlanReview,
    fetchPayload,
    fetchUpdateNotice,
    performUpdate,
    analytics: context.analytics as FakeAnalytics,
    telemetry: context.telemetry as FakeFrontendTelemetry,
  };
}

function createAutoCloseTimers(): AutoCloseTimers {
  const pending: Array<() => void> = [];
  const cancels: Array<Mock<() => void>> = [];
  const closeWindow = vi.fn<() => void>();

  const scheduleTimeout: ScheduleTimeout = (callback) => {
    pending.push(callback);
    const cancel = vi.fn<() => void>();
    cancels.push(cancel);
    return cancel;
  };

  return {
    scheduleTimeout,
    closeWindow,
    advance: () => {
      pending.shift()?.();
    },
    lastCancel: () => cancels[cancels.length - 1],
  };
}
