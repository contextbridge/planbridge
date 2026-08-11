import { FakeFrontendBrowser, fakeFrontendContext } from '@contextbridge/context/testHelpers';
import { settings } from '@contextbridge/shared/testFactories';
import type { ComponentType, ReactElement } from 'react';
import { ThemeControllerImpl } from '#src/ThemeController.ts';
import type { AnnotationAppContext as AnnotationAppContextValue } from '#src/useAppContext.ts';
import { AnnotationAppContext } from '#src/useAppContext.ts';

export function createStoryAppContext(overrides?: Partial<AnnotationAppContextValue>): AnnotationAppContextValue {
  return {
    ...fakeFrontendContext({
      browser: new FakeFrontendBrowser({ timers: 'real' }),
    }),
    fetchPayload: () => Promise.resolve({ content: '', contentKind: 'plan' }),
    fetchUpdateNotice: () => Promise.resolve(null),
    submitAnnotation: () => Promise.resolve(),
    settings: settings.build(),
    updateSettings: () => Promise.resolve(true),
    autoCloseDelaySeconds: 3,
    themeController: new ThemeControllerImpl(),
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
