import {
  type FakeAnalytics,
  FakeFrontendBrowser,
  type FakeFrontendTelemetry,
  fakeFrontendContext,
} from '@contextbridge/context/testHelpers';
import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { Mock } from 'vitest';
import { vi } from 'vitest';
import type { AnnotationAppContext } from '../useAppContext.ts';

export type AutoCloseTimers = FakeFrontendBrowser;

export interface FakeAppContextResult {
  context: AnnotationAppContext;
  timers: AutoCloseTimers;
  submitAnnotation: Mock<(submission: AnnotationSubmission) => Promise<void>>;
  fetchPayload: Mock<() => Promise<AnnotationPayload>>;
  fetchUpdateNotice: Mock<() => Promise<UpdateNotice | null>>;
  analytics: FakeAnalytics;
  telemetry: FakeFrontendTelemetry;
}

export function createFakeAppContext(overrides?: Partial<AnnotationAppContext>): FakeAppContextResult {
  const timers = new FakeFrontendBrowser();
  const submitAnnotation = vi.fn<(submission: AnnotationSubmission) => Promise<void>>().mockResolvedValue(undefined);
  const fetchPayload = vi
    .fn<() => Promise<AnnotationPayload>>()
    .mockResolvedValue({ content: '', contentKind: 'plan' });
  const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(null);
  const context: AnnotationAppContext = {
    ...fakeFrontendContext({
      browser: timers,
    }),
    fetchPayload,
    fetchUpdateNotice,
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
    analytics: context.analytics as FakeAnalytics,
    telemetry: context.telemetry as FakeFrontendTelemetry,
  };
}
