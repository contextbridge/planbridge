import type { RenderHookOptions, RenderHookResult } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { PlanAppContext as PlanAppContextValue } from '../useAppContext.ts';
import { PlanAppContext } from '../useAppContext.ts';
import type { FakeAppContextResult } from './createFakeAppContext.ts';
import { createFakeAppContext } from './createFakeAppContext.ts';

export type RenderPlanHookResult<Result, Props> = RenderHookResult<Result, Props> & FakeAppContextResult;

export function renderPlanHook<Result, Props>(
  callback: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props> & { contextOverrides?: Partial<PlanAppContextValue> },
): RenderPlanHookResult<Result, Props> {
  const { contextOverrides, ...renderOptions } = options ?? {};
  const fake = createFakeAppContext(contextOverrides);
  const result = renderHook(callback, {
    ...renderOptions,
    wrapper: ({ children }: { children: ReactNode }) => (
      <PlanAppContext.Provider value={fake.context}>{children}</PlanAppContext.Provider>
    ),
  });
  return { ...result, ...fake };
}
