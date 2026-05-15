import type { RenderHookOptions, RenderHookResult } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { AnnotationAppContext as AnnotationAppContextValue } from '../useAppContext.ts';
import { AnnotationAppContext } from '../useAppContext.ts';
import type { FakeAppContextResult } from './createFakeAppContext.ts';
import { createFakeAppContext } from './createFakeAppContext.ts';

export type RenderAnnotationHookResult<Result, Props> = RenderHookResult<Result, Props> & FakeAppContextResult;

export function renderAnnotationHook<Result, Props>(
  callback: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props> & { contextOverrides?: Partial<AnnotationAppContextValue> },
): RenderAnnotationHookResult<Result, Props> {
  const { contextOverrides, ...renderOptions } = options ?? {};
  const fake = createFakeAppContext(contextOverrides);
  const result = renderHook(callback, {
    ...renderOptions,
    wrapper: ({ children }: { children: ReactNode }) => (
      <AnnotationAppContext.Provider value={fake.context}>{children}</AnnotationAppContext.Provider>
    ),
  });
  return { ...result, ...fake };
}
