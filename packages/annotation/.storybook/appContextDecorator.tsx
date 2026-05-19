import { fakeFrontendContext } from '@contextbridge/context/testHelpers';
import type { ComponentType, ReactElement } from 'react';
import type { AnnotationAppContext as AnnotationAppContextValue } from '../src/useAppContext.ts';
import { AnnotationAppContext } from '../src/useAppContext.ts';

export function createStoryAppContext(overrides?: Partial<AnnotationAppContextValue>): AnnotationAppContextValue {
  return {
    ...fakeFrontendContext({
      browser: {
        closeWindow: () => {},
        scheduleTimeout: (callback, delayMs) => {
          const id = window.setTimeout(callback, delayMs);
          return () => {
            window.clearTimeout(id);
          };
        },
        addBeforeUnloadGuard: () => () => {},
      },
    }),
    fetchPayload: () => Promise.resolve({ content: '', contentKind: 'plan' }),
    fetchUpdateNotice: () => Promise.resolve(null),
    submitAnnotation: () => Promise.resolve(),
    autoCloseDelaySeconds: 3,
    ...overrides,
  };
}

export function withAppContext(overrides?: Partial<AnnotationAppContextValue>) {
  return function AppContextDecorator(Story: ComponentType): ReactElement {
    const context = createStoryAppContext(overrides);
    return (
      <AnnotationAppContext.Provider value={context}>
        <Story />
      </AnnotationAppContext.Provider>
    );
  };
}
