import type { AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { expect } from 'vitest';
import { AnnotatedMarkdown, annotatedMarkdownTestIds } from '#src/AnnotatedMarkdown.tsx';
import { annotationDraftCommentComposerTestIds } from '#src/AnnotationDraftCommentComposer.tsx';
import type { AppProps } from '#src/App.tsx';
import { App } from '#src/App.tsx';
import { submitBarTestIds } from '#src/SubmitBar.tsx';
import type { AnnotationAppContext as AnnotationAppContextValue } from '#src/useAppContext.ts';
import { AnnotationAppContext } from '#src/useAppContext.ts';
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

/** Render `markdown` through {@link AnnotatedMarkdown} and return its annotatable container. */
export function renderAnnotatedMarkdown(markdown: string): HTMLDivElement {
  const containerRef = createRef<HTMLDivElement>();
  render(<AnnotatedMarkdown content={markdown} containerRef={containerRef} />);
  return containerRef.current!;
}

export type SubmitShortcutModifier = 'meta' | 'ctrl';

export function pressSubmitShortcut(element: Element, modifier: SubmitShortcutModifier): void {
  fireEvent.keyDown(element, {
    key: 'Enter',
    metaKey: modifier === 'meta',
    ctrlKey: modifier === 'ctrl',
  });
}
/** Text within `node` from `from` to `to`; omitted offsets select the whole node. */
export interface TextSelection {
  node: Text;
  from?: number;
  to?: number;
}

export function textRange({ node, from = 0, to = node.data.length }: TextSelection): Range {
  const range = document.createRange();
  range.setStart(node, from);
  range.setEnd(node, to);
  return range;
}

export function drag(selection: TextSelection): void {
  const range = textRange(selection);

  const windowSelection = window.getSelection();
  if (!windowSelection) {
    throw new Error('Expected browser selection API to be available.');
  }

  windowSelection.removeAllRanges();
  windowSelection.addRange(range);
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
