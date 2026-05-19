import type { AddBeforeUnloadGuard, ScheduleTimeout } from '@contextbridge/context/frontend';
import {
  type FakeAnalytics,
  type FakeFrontendTelemetry,
  fakeFrontendContext,
} from '@contextbridge/context/testHelpers';
import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { Mock } from 'vitest';
import { vi } from 'vitest';
import type { AnnotationAppContext } from '../useAppContext.ts';

export interface AutoCloseTimers {
  scheduleTimeout: ScheduleTimeout;
  closeWindow: Mock<() => void>;
  advance: () => void;
  lastCancel: () => Mock<() => void> | undefined;
}

export interface UnloadGuardHarness {
  addBeforeUnloadGuard: AddBeforeUnloadGuard;
  isRegistered: () => boolean;
  trigger: () => BeforeUnloadEvent;
}

export interface FakeAppContextResult {
  context: AnnotationAppContext;
  timers: AutoCloseTimers;
  unloadGuard: UnloadGuardHarness;
  submitAnnotation: Mock<(submission: AnnotationSubmission) => Promise<void>>;
  fetchPayload: Mock<() => Promise<AnnotationPayload>>;
  fetchUpdateNotice: Mock<() => Promise<UpdateNotice | null>>;
  analytics: FakeAnalytics;
  telemetry: FakeFrontendTelemetry;
}

export function createFakeAppContext(overrides?: Partial<AnnotationAppContext>): FakeAppContextResult {
  const timers = createAutoCloseTimers();
  const unloadGuard = createUnloadGuard();
  const submitAnnotation = vi.fn<(submission: AnnotationSubmission) => Promise<void>>().mockResolvedValue(undefined);
  const fetchPayload = vi
    .fn<() => Promise<AnnotationPayload>>()
    .mockResolvedValue({ content: '', contentKind: 'plan' });
  const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(null);
  const context: AnnotationAppContext = {
    ...fakeFrontendContext({
      browser: {
        scheduleTimeout: timers.scheduleTimeout,
        closeWindow: timers.closeWindow,
        addBeforeUnloadGuard: unloadGuard.addBeforeUnloadGuard,
      },
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
    unloadGuard,
    submitAnnotation,
    fetchPayload,
    fetchUpdateNotice,
    analytics: context.analytics as FakeAnalytics,
    telemetry: context.telemetry as FakeFrontendTelemetry,
  };
}

function createUnloadGuard(): UnloadGuardHarness {
  const handlers = new Set<(event: BeforeUnloadEvent) => void>();
  return {
    addBeforeUnloadGuard: (handler) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    isRegistered: () => handlers.size > 0,
    trigger: () => {
      const event = new Event('beforeunload', { cancelable: true });
      handlers.forEach((handler) => {
        handler(event);
      });
      return event;
    },
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
