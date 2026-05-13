import { fireEvent, render, screen } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import { annotatedMarkdownTestIds } from '../AnnotatedMarkdown.tsx';
import type { AppProps } from '../App.tsx';
import { App } from '../App.tsx';
import type { AnnotationAppContext as AnnotationAppContextValue } from '../useAppContext.ts';
import { AnnotationAppContext } from '../useAppContext.ts';
import type { FakeAppContextResult } from './createFakeAppContext.ts';
import { createFakeAppContext } from './createFakeAppContext.ts';

export type RenderAppResult = FakeAppContextResult & { result: RenderResult };

export function renderApp(
  props: AppProps = {},
  contextOverrides?: Partial<AnnotationAppContextValue>,
): RenderAppResult {
  const fake = createFakeAppContext(contextOverrides);
  const { ErrorBoundary } = fake.context.telemetry;
  const result = render(
    <ErrorBoundary>
      <AnnotationAppContext.Provider value={fake.context}>
        <App {...props} />
      </AnnotationAppContext.Provider>
    </ErrorBoundary>,
  );
  return { result, ...fake };
}

type DragArgs = {
  target: Text;
  from: number;
  to: number;
};

export function drag({ target, from, to }: DragArgs): void {
  const range = document.createRange();
  range.setStart(target, from);
  range.setEnd(target, to);

  const selection = window.getSelection();
  if (!selection) {
    throw new Error('Expected browser selection API to be available.');
  }

  selection.removeAllRanges();
  selection.addRange(range);
  fireEvent.mouseUp(screen.getByTestId(annotatedMarkdownTestIds.container));
}
