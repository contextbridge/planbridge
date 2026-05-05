import { render } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import type { AppProps } from '../App.tsx';
import { App } from '../App.tsx';
import type { PlanAppContext as PlanAppContextValue } from '../useAppContext.ts';
import { PlanAppContext } from '../useAppContext.ts';
import type { FakeAppContextResult } from './createFakeAppContext.ts';
import { createFakeAppContext } from './createFakeAppContext.ts';

export type RenderAppResult = FakeAppContextResult & { result: RenderResult };

export function renderApp(props: AppProps = {}, contextOverrides?: Partial<PlanAppContextValue>): RenderAppResult {
  const fake = createFakeAppContext(contextOverrides);
  const { ErrorBoundary } = fake.context.telemetry;
  const result = render(
    <ErrorBoundary>
      <PlanAppContext.Provider value={fake.context}>
        <App {...props} />
      </PlanAppContext.Provider>
    </ErrorBoundary>,
  );
  return { result, ...fake };
}
