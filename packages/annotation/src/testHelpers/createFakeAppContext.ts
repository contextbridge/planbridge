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
import type { AnnotationAppContext } from '#src/useAppContext.ts';
import { FakeThemeController } from './FakeThemeController.ts';

export interface FakeAppContextResult {
  context: AnnotationAppContext;
  browser: FakeFrontendBrowser;
  submitAnnotation: Mock<(submission: AnnotationSubmission) => Promise<void>>;
  fetchPayload: Mock<() => Promise<AnnotationPayload>>;
  fetchUpdateNotice: Mock<() => Promise<UpdateNotice | null>>;
  analytics: FakeAnalytics;
  telemetry: FakeFrontendTelemetry;
  themeController: FakeThemeController;
}

export function createFakeAppContext(overrides?: Partial<AnnotationAppContext>): FakeAppContextResult {
  const browser = new FakeFrontendBrowser();
  const submitAnnotation = vi.fn<(submission: AnnotationSubmission) => Promise<void>>().mockResolvedValue(undefined);
  const fetchPayload = vi
    .fn<() => Promise<AnnotationPayload>>()
    .mockResolvedValue({ content: '', contentKind: 'plan' });
  const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(null);
  const themeController = new FakeThemeController();
  const context: AnnotationAppContext = {
    ...fakeFrontendContext({
      browser,
    }),
    fetchPayload,
    fetchUpdateNotice,
    submitAnnotation,
    autoCloseDelaySeconds: 3,
    themeController,
    ...overrides,
  };
  return {
    context,
    browser,
    submitAnnotation,
    fetchPayload,
    fetchUpdateNotice,
    analytics: context.analytics as FakeAnalytics,
    telemetry: context.telemetry as FakeFrontendTelemetry,
    themeController,
  };
}
