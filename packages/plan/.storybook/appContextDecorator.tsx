import { fakeFrontendContext } from '@contextbridge/context/testHelpers';
import type { ComponentType, ReactElement } from 'react';
import type { PlanAppContext as PlanAppContextValue } from '../src/useAppContext.ts';
import { PlanAppContext } from '../src/useAppContext.ts';

export function createStoryAppContext(overrides?: Partial<PlanAppContextValue>): PlanAppContextValue {
  return {
    ...fakeFrontendContext({
      scheduleTimeout: (callback, delayMs) => {
        const id = window.setTimeout(callback, delayMs);
        return () => {
          window.clearTimeout(id);
        };
      },
      closeWindow: () => {},
    }),
    fetchPayload: () => Promise.resolve({ content: '' }),
    fetchUpdateNotice: () => Promise.resolve(null),
    performUpdate: () => Promise.resolve({ status: 'success' as const, message: 'Updated.' }),
    submitPlanReview: () => Promise.resolve(),
    autoCloseDelaySeconds: 3,
    ...overrides,
  };
}

export function withAppContext(overrides?: Partial<PlanAppContextValue>) {
  return function AppContextDecorator(Story: ComponentType): ReactElement {
    const context = createStoryAppContext(overrides);
    return (
      <PlanAppContext.Provider value={context}>
        <Story />
      </PlanAppContext.Provider>
    );
  };
}
