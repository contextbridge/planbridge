import type { ScheduleTimeout } from '@contextbridge/context/frontend';
import {
  type FakeAnalytics,
  type FakeFrontendTelemetry,
  fakeFrontendContext,
} from '@contextbridge/context/testHelpers';
import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { UpdateOutcome } from '@contextbridge/shared/updateOutcomeSchema';
import type { Mock } from 'vitest';
import { vi } from 'vitest';
import type { AnnotationAppContext } from '../useAppContext.ts';

export interface AutoCloseTimers {
  scheduleTimeout: ScheduleTimeout;
  closeWindow: Mock<() => void>;
  advance: () => void;
  lastCancel: () => Mock<() => void> | undefined;
}

export interface FakeAppContextResult {
  context: AnnotationAppContext;
  timers: AutoCloseTimers;
  submitAnnotation: Mock<(submission: AnnotationSubmission) => Promise<void>>;
  fetchPayload: Mock<() => Promise<AnnotationPayload>>;
  fetchUpdateNotice: Mock<() => Promise<UpdateNotice | null>>;
  triggerUpdate: Mock<() => Promise<UpdateOutcome>>;
  analytics: FakeAnalytics;
  telemetry: FakeFrontendTelemetry;
}

export function createFakeAppContext(overrides?: Partial<AnnotationAppContext>): FakeAppContextResult {
  const timers = createAutoCloseTimers();
  const submitAnnotation = vi.fn<(submission: AnnotationSubmission) => Promise<void>>().mockResolvedValue(undefined);
  const fetchPayload = vi
    .fn<() => Promise<AnnotationPayload>>()
    .mockResolvedValue({ content: '', contentKind: 'plan' });
  const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(null);
  const triggerUpdate = vi.fn<() => Promise<UpdateOutcome>>().mockResolvedValue({ status: 'success' });
  const context: AnnotationAppContext = {
    ...fakeFrontendContext({
      scheduleTimeout: timers.scheduleTimeout,
      closeWindow: timers.closeWindow,
    }),
    fetchPayload,
    fetchUpdateNotice,
    triggerUpdate,
    submitAnnotation,
    autoCloseDelaySeconds: 3,
    ...overrides,
  };
  return {
    context,
    timers,
    submitAnnotation,
    fetchPayload,
    fetchUpdateNotice,
    triggerUpdate,
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
