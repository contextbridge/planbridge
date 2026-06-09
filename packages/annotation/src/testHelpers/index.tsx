import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect } from 'vitest';
import { annotatedMarkdownTestIds } from '../AnnotatedMarkdown.tsx';
import { annotationDraftCommentComposerTestIds } from '../AnnotationDraftCommentComposer.tsx';
import type { AppProps } from '../App.tsx';
import { App } from '../App.tsx';
import { submitBarTestIds } from '../SubmitBar.tsx';
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

export type SubmitShortcutModifier = 'meta' | 'ctrl';

export function pressSubmitShortcut(element: Element, modifier: SubmitShortcutModifier): void {
  fireEvent.keyDown(element, {
    key: 'Enter',
    metaKey: modifier === 'meta',
    ctrlKey: modifier === 'ctrl',
  });
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

export interface SaveAnnotationArgs {
  user: ReturnType<typeof userEvent.setup>;
  /** An already-rendered, click-annotatable target (e.g. a tagged diagram node, edge, or block). */
  target: Element;
  body: string;
}

export interface AnnotateAndSubmitArgs extends SaveAnnotationArgs {
  submitAnnotation: RenderAppResult['submitAnnotation'];
}

/**
 * Open an annotation draft by clicking `target`, type `body`, and save it. Clicks the element
 * directly (`fireEvent.click`), which suits click-annotatable targets like diagram nodes; text
 * selections come from {@link drag} instead. Callers must wait until `target` is interactive first.
 */
export async function saveAnnotation({ user, target, body }: SaveAnnotationArgs): Promise<void> {
  fireEvent.click(target);
  await user.type(await screen.findByTestId(annotationDraftCommentComposerTestIds.textarea), body);
  await user.click(screen.getByTestId(annotationDraftCommentComposerTestIds.saveButton));
  await waitFor(() => {
    expect(screen.queryByTestId(annotationDraftCommentComposerTestIds.container)).not.toBeInTheDocument();
  });
}

/** {@link saveAnnotation} then submit the review; resolves with the latest submitted payload. */
export async function annotateAndSubmit({
  user,
  submitAnnotation,
  target,
  body,
}: AnnotateAndSubmitArgs): Promise<AnnotationSubmission | undefined> {
  await saveAnnotation({ user, target, body });
  await user.click(screen.getByTestId(submitBarTestIds.button));
  await waitFor(() => {
    expect(submitAnnotation).toHaveBeenCalled();
  });
  return submitAnnotation.mock.calls.at(-1)?.[0];
}
