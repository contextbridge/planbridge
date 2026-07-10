import { FakeFrontendBrowser, fakeFrontendContext } from '@contextbridge/context/testHelpers';
import type { ComponentType, ReactElement } from 'react';
import { ThemeControllerImpl } from '../ThemeController.ts';
import type { AnnotationAppContext as AnnotationAppContextValue } from '../useAppContext.ts';
import { AnnotationAppContext } from '../useAppContext.ts';

export function createStoryAppContext(overrides?: Partial<AnnotationAppContextValue>): AnnotationAppContextValue {
  return {
    ...fakeFrontendContext({
      browser: new FakeFrontendBrowser({ timers: 'real' }),
    }),
    fetchPayload: () => Promise.resolve({ content: '', contentKind: 'plan' }),
    fetchUpdateNotice: () => Promise.resolve(null),
    submitAnnotation: () => Promise.resolve(),
    autoCloseDelaySeconds: 3,
    themeController: new ThemeControllerImpl({ storage: new StoryThemeStorage() }),
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

class StoryThemeStorage implements Storage {
  readonly #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}
