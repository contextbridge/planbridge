import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { DOCS_URL, FEEDBACK_URL, GITHUB_REPO_URL, SLACK_COMMUNITY_URL } from '@contextbridge/shared/links';
import { createDeferred } from '@contextbridge/shared/testHelpers';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { headerTestIds } from '@contextbridge/ui/components/Header';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { annotatedMarkdownTestIds } from './AnnotatedMarkdown.tsx';
import { annotationPopoverTestIds } from './AnnotationPopover.tsx';
import { appCopy, appTestIds } from './App.tsx';
import { globalCommentComposerTestIds } from './GlobalCommentComposer.tsx';
import { submitBarTestIds } from './SubmitBar.tsx';
import { drag, pressSubmitShortcut, renderApp } from './testHelpers/index.tsx';
import { updateNoticeCardTestIds } from './UpdateNoticeCard.tsx';
import { closeReviewDialogCopy } from './useAnnotationState.ts';

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  it('loads payload content via the injected fetchPayload', async () => {
    const fetchPayload = vi
      .fn<() => Promise<AnnotationPayload>>()
      .mockResolvedValue({ contentKind: 'plan', content: '# Loaded plan\n\nStep 1', title: 'Loaded plan' });

    const { analytics } = renderApp({}, { fetchPayload });

    expect(screen.getByTestId(appTestIds.loading)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Loaded plan' })).toBeInTheDocument();
    expect(fetchPayload).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(analytics.captures.some((c) => c.event === 'plan_review_viewed')).toBe(true);
    });
  });

  it('captures plan_review_viewed when an initial payload is supplied', () => {
    const { analytics } = renderApp({ initialPayload: { contentKind: 'plan', content: '# Ready' } });
    const viewed = analytics.captures.find((c) => c.event === 'plan_review_viewed');
    expect(viewed).toBeDefined();
    expect(viewed?.properties?.['bytes']).toBe('# Ready'.length);
  });

  it('shows an empty state when the plan content is blank', () => {
    renderApp({ initialPayload: { contentKind: 'plan', content: '' } });

    expect(screen.getByTestId(appTestIds.emptyState)).toHaveTextContent(appCopy.emptyState);
  });

  it('renders the update-notice card when /update-notice resolves with a notice', async () => {
    const notice: UpdateNotice = { currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' };
    const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(notice);
    renderApp({ initialPayload: { contentKind: 'plan', content: '# Ready' } }, { fetchUpdateNotice });

    expect(await screen.findByTestId(updateNoticeCardTestIds.container)).toBeInTheDocument();
  });

  it('does not render the card when /update-notice resolves null', async () => {
    const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(null);
    renderApp({ initialPayload: { contentKind: 'plan', content: '# Ready' } }, { fetchUpdateNotice });

    await waitFor(() => {
      expect(fetchUpdateNotice).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId(updateNoticeCardTestIds.container)).not.toBeInTheDocument();
  });

  it('dismisses the card and keeps it hidden when × is clicked', async () => {
    const user = userEvent.setup();
    const notice: UpdateNotice = { currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' };
    const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(notice);
    renderApp({ initialPayload: { contentKind: 'plan', content: '# Ready' } }, { fetchUpdateNotice });

    const card = await screen.findByTestId(updateNoticeCardTestIds.container);
    expect(card).toBeInTheDocument();

    await user.click(screen.getByTestId(updateNoticeCardTestIds.dismissButton));

    expect(screen.queryByTestId(updateNoticeCardTestIds.container)).not.toBeInTheDocument();
  });

  it('submits a global comment typed into the composer as a global thread', async () => {
    const user = userEvent.setup();
    const { submitAnnotation, browser } = renderApp({ initialPayload: { contentKind: 'plan', content: '# Ship it' } });

    await user.type(screen.getByTestId(globalCommentComposerTestIds.textarea), 'Please spell out rollback steps');

    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(submitAnnotation).toHaveBeenCalledTimes(1);
    });

    const submission = submitAnnotation.mock.calls[0]?.[0];
    expect(submission).toMatchObject({
      status: 'changes_requested',
      threads: [
        {
          subject: { kind: 'global' },
          messages: [{ body: 'Please spell out rollback steps' }],
        },
      ],
    });
    expect(screen.getByTestId(submitBarTestIds.countdown)).toHaveTextContent('This window will close in 3 seconds.');

    act(() => browser.advance());
    act(() => browser.advance());
    act(() => browser.advance());
    expect(browser.closeWindowCallCount).toBe(1);
  });

  it('submits the review with Cmd+Enter from the global comment textarea', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({ initialPayload: { contentKind: 'plan', content: '# Ship it' } });
    const textarea = screen.getByTestId(globalCommentComposerTestIds.textarea);

    await user.type(textarea, 'Please spell out rollback steps');
    pressSubmitShortcut(textarea, 'meta');

    await waitFor(() => {
      expect(submitAnnotation).toHaveBeenCalledTimes(1);
    });

    const submission = submitAnnotation.mock.calls[0]?.[0];
    expect(submission).toMatchObject({
      status: 'changes_requested',
      threads: [
        {
          subject: { kind: 'global' },
          messages: [{ body: 'Please spell out rollback steps' }],
        },
      ],
    });
  });

  it('submits the review with Ctrl+Enter from the global comment textarea', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({ initialPayload: { contentKind: 'plan', content: '# Ship it' } });
    const textarea = screen.getByTestId(globalCommentComposerTestIds.textarea);

    await user.type(textarea, 'Needs a migration plan');
    pressSubmitShortcut(textarea, 'ctrl');

    await waitFor(() => {
      expect(submitAnnotation).toHaveBeenCalledTimes(1);
    });

    const submission = submitAnnotation.mock.calls[0]?.[0];
    expect(submission).toMatchObject({
      status: 'changes_requested',
      threads: [
        {
          subject: { kind: 'global' },
          messages: [{ body: 'Needs a migration plan' }],
        },
      ],
    });
  });

  it('opens the approval close dialog after staying on an attempted close with no comments', async () => {
    const user = userEvent.setup();
    const { browser, submitAnnotation } = renderApp({ initialPayload: { contentKind: 'plan', content: '# Ship it' } });

    await act(async () => {
      browser.triggerBeforeUnload();
      await Promise.resolve();
    });

    const dialog = await screen.findByTestId(appTestIds.closeReviewDialog);
    expect(dialog).toHaveTextContent(closeReviewDialogCopy.empty.title);
    expect(dialog).toHaveTextContent(closeReviewDialogCopy.empty.description);
    expect(screen.getByTestId(appTestIds.closeReviewDialogCancelButton)).toHaveTextContent(
      closeReviewDialogCopy.cancelLabel,
    );
    expect(screen.getByTestId(appTestIds.closeReviewDialogActionButton)).toHaveTextContent(
      closeReviewDialogCopy.empty.primaryActionLabel,
    );

    await user.click(screen.getByTestId(appTestIds.closeReviewDialogCancelButton));

    await waitFor(() => {
      expect(screen.queryByTestId(appTestIds.closeReviewDialog)).not.toBeInTheDocument();
    });
    expect(submitAnnotation).not.toHaveBeenCalled();
  });

  it('opens the submit-feedback close dialog after staying on an attempted close with feedback', async () => {
    const user = userEvent.setup();
    const { browser, submitAnnotation } = renderApp({ initialPayload: { contentKind: 'plan', content: '# Ship it' } });

    await user.type(screen.getByTestId(globalCommentComposerTestIds.textarea), 'Needs rollback details');

    await act(async () => {
      browser.triggerBeforeUnload();
      await Promise.resolve();
    });

    const dialog = await screen.findByTestId(appTestIds.closeReviewDialog);
    expect(dialog).toHaveTextContent(closeReviewDialogCopy.feedback.title);
    expect(dialog).toHaveTextContent(closeReviewDialogCopy.feedback.description);
    expect(screen.getByTestId(appTestIds.closeReviewDialogCancelButton)).toHaveTextContent(
      closeReviewDialogCopy.cancelLabel,
    );
    expect(screen.getByTestId(appTestIds.closeReviewDialogActionButton)).toHaveTextContent(
      closeReviewDialogCopy.feedback.primaryActionLabel,
    );

    await user.click(screen.getByTestId(appTestIds.closeReviewDialogActionButton));

    await waitFor(() => {
      expect(screen.queryByTestId(appTestIds.closeReviewDialog)).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(submitAnnotation).toHaveBeenCalledTimes(1);
    });
    expect(submitAnnotation.mock.calls[0]?.[0]).toMatchObject({ status: 'changes_requested' });
  });

  it('does not submit again from the global shortcut while submitting', async () => {
    const user = userEvent.setup();
    const pendingSubmission = createDeferred<void>();
    const submitAnnotation = vi
      .fn<(submission: AnnotationSubmission) => Promise<void>>()
      .mockReturnValue(pendingSubmission.promise);
    renderApp({ initialPayload: { contentKind: 'plan', content: '# Ship it' } }, { submitAnnotation });
    const textarea = screen.getByTestId(globalCommentComposerTestIds.textarea);

    await user.type(textarea, 'Needs a migration plan');
    pressSubmitShortcut(textarea, 'meta');

    await waitFor(() => {
      expect(screen.getByTestId(submitBarTestIds.button)).toBeDisabled();
    });
    pressSubmitShortcut(textarea, 'meta');

    expect(submitAnnotation).toHaveBeenCalledTimes(1);

    pendingSubmission.resolve();
    await screen.findByTestId(submitBarTestIds.countdown);
  });

  it('does not submit again from the global shortcut after submitted', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({ initialPayload: { contentKind: 'plan', content: '# Ship it' } });
    const textarea = screen.getByTestId(globalCommentComposerTestIds.textarea);

    await user.type(textarea, 'Looks good');
    pressSubmitShortcut(textarea, 'meta');

    await screen.findByTestId(submitBarTestIds.countdown);
    pressSubmitShortcut(textarea, 'meta');

    expect(submitAnnotation).toHaveBeenCalledTimes(1);
  });

  it('keeps plain Enter as textarea input in the global comment composer', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({ initialPayload: { contentKind: 'plan', content: '# Ship it' } });
    const textarea = screen.getByTestId(globalCommentComposerTestIds.textarea);

    await user.type(textarea, 'Line one{enter}Line two');

    expect(textarea).toHaveValue('Line one\nLine two');
    expect(submitAnnotation).not.toHaveBeenCalled();
  });

  it('opens an annotation draft from a clicked target and submits it', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({
      initialPayload: { contentKind: 'plan', content: '# Title\n\nExplain the parser ordering.' },
    });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Title' });
    await waitFor(() => {
      expect(heading).toHaveAttribute('data-target-id');
    });

    await user.click(heading);
    expect(await screen.findByTestId(annotationPopoverTestIds.container)).toBeInTheDocument();

    await user.type(screen.getByTestId(annotationPopoverTestIds.textarea), 'Why annotate the heading?');
    await user.click(screen.getByTestId(annotationPopoverTestIds.saveButton));

    expect(screen.getByText('Why annotate the heading?')).toBeInTheDocument();

    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(submitAnnotation).toHaveBeenCalledTimes(1);
    });

    const submission = submitAnnotation.mock.calls[0]?.[0];
    expect(submission?.status).toBe('changes_requested');
    expect(submission?.threads).toHaveLength(1);
    expect(submission?.threads[0]?.subject.kind).toBe('annotation');
    expect(submission?.threads[0]?.messages[0]?.body).toBe('Why annotate the heading?');
  });

  it('uses the generic discard workflow before submitting with an unsaved annotation draft', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({
      initialPayload: { contentKind: 'plan', content: '# Title\n\nExplain the parser ordering.' },
    });

    const heading = await screen.findByRole('heading', { level: 1, name: 'Title' });
    await waitFor(() => {
      expect(heading).toHaveAttribute('data-target-id');
    });

    await user.click(heading);
    await user.type(await screen.findByTestId(annotationPopoverTestIds.textarea), 'Unsaved annotation');
    await user.click(screen.getByTestId(submitBarTestIds.button));

    expect(await screen.findByTestId(appTestIds.discardDraftDialog)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Discard unsaved comment?' })).toBeInTheDocument();
    expect(submitAnnotation).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Keep Editing' }));

    expect(screen.getByTestId(annotationPopoverTestIds.textarea)).toHaveValue('Unsaved annotation');
    expect(submitAnnotation).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(submitBarTestIds.button));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));
    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(submitAnnotation).toHaveBeenCalledTimes(1);
    });
    expect(submitAnnotation.mock.calls[0]?.[0]).toMatchObject({
      status: 'approved',
      threads: [],
    });
  });

  it('updates the visible countdown after submission without waiting on real timers', async () => {
    const user = userEvent.setup();
    const { browser } = renderApp({ initialPayload: { contentKind: 'plan', content: '# Ship it' } });

    await user.click(screen.getByTestId(submitBarTestIds.button));

    expect(await screen.findByTestId(submitBarTestIds.countdown)).toHaveTextContent(
      'This window will close in 3 seconds.',
    );

    act(() => browser.advance());
    expect(screen.getByTestId(submitBarTestIds.countdown)).toHaveTextContent('This window will close in 2 seconds.');
  });

  it('shows Codex-specific handoff notice on approval when source is hook_codex', async () => {
    const user = userEvent.setup();
    renderApp({
      initialPayload: { contentKind: 'plan', content: '# Ship it', metadata: { entrypoint: 'hook_codex' } },
    });

    await user.click(screen.getByTestId(submitBarTestIds.button));

    await screen.findByTestId(submitBarTestIds.countdown);
    expect(screen.getByTestId(submitBarTestIds.codexHandoffNotice)).toBeInTheDocument();
  });

  it('shows default countdown for hook_codex when changes are requested', async () => {
    const user = userEvent.setup();
    renderApp({
      initialPayload: { contentKind: 'plan', content: '# Ship it', metadata: { entrypoint: 'hook_codex' } },
    });

    await user.type(screen.getByTestId(globalCommentComposerTestIds.textarea), 'Needs work');
    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(screen.getByTestId(submitBarTestIds.countdown)).toBeInTheDocument();
    });
    expect(screen.queryByTestId(submitBarTestIds.codexHandoffNotice)).not.toBeInTheDocument();
  });

  it('shows default countdown for hook_claude approval', async () => {
    const user = userEvent.setup();
    renderApp({
      initialPayload: { contentKind: 'plan', content: '# Ship it', metadata: { entrypoint: 'hook_claude' } },
    });

    await user.click(screen.getByTestId(submitBarTestIds.button));

    await screen.findByTestId(submitBarTestIds.countdown);
    expect(screen.queryByTestId(submitBarTestIds.codexHandoffNotice)).not.toBeInTheDocument();
  });

  it('syntax-highlights fenced code blocks with hljs token spans', async () => {
    renderApp({
      initialPayload: { contentKind: 'plan', content: '# Plan\n\n```ts\nconst greeting = "hello";\n```\n' },
    });

    const pre = await screen.findByRole('heading', { level: 1 }).then((heading) => {
      const root = heading.closest('div')!;
      return root.querySelector('pre')!;
    });

    expect(pre.querySelector('code')?.classList.contains('hljs')).toBe(true);
    const stringToken = pre.querySelector('.hljs-string');
    expect(stringToken).not.toBeNull();
    expect(stringToken!.textContent).toBe('"hello"');
    const keyword = pre.querySelector('.hljs-keyword');
    expect(keyword?.textContent).toBe('const');
  });

  it('snaps a drag-selection inside a code token to the full token boundary', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({
      initialPayload: { contentKind: 'plan', content: '```ts\nconst greeting = "helloWorld";\n```\n' },
    });

    await waitFor(() => {
      expect(document.querySelector('pre code.hljs .hljs-string')).not.toBeNull();
    });

    const stringToken = document.querySelector<HTMLElement>('pre code.hljs .hljs-string')!;
    const text = stringToken.firstChild as Text;

    drag({ target: text, from: 3, to: 5 });

    await screen.findByTestId(annotationPopoverTestIds.container);

    await user.type(screen.getByTestId(annotationPopoverTestIds.textarea), 'this literal is too long');
    await user.click(screen.getByTestId(annotationPopoverTestIds.saveButton));
    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(submitAnnotation).toHaveBeenCalledTimes(1);
    });

    const submission = submitAnnotation.mock.calls[0]?.[0];
    expect(submission?.threads).toHaveLength(1);
    const anchor = submission?.threads[0]?.subject.kind === 'annotation' ? submission.threads[0].subject.anchor : null;
    expect(anchor?.quote.exact).toBe('"helloWorld"');
  });

  it('scopes a code-token click to just the token, not the whole block', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({
      initialPayload: { contentKind: 'plan', content: '```ts\nconst greeting = "hello";\n```\n' },
    });

    await waitFor(() => {
      expect(document.querySelector('pre code.hljs .hljs-string')).not.toBeNull();
    });

    const stringToken = document.querySelector<HTMLElement>('pre code.hljs .hljs-string')!;
    await user.click(stringToken);

    await screen.findByTestId(annotationPopoverTestIds.container);
    await user.type(screen.getByTestId(annotationPopoverTestIds.textarea), 'too long');
    await user.click(screen.getByTestId(annotationPopoverTestIds.saveButton));
    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(submitAnnotation).toHaveBeenCalledTimes(1);
    });

    const submission = submitAnnotation.mock.calls[0]?.[0];
    const anchor = submission?.threads[0]?.subject.kind === 'annotation' ? submission.threads[0].subject.anchor : null;
    expect(anchor?.quote.exact).toBe('"hello"');
  });

  it('renders markdown links with target="_blank" and rel="noreferrer"', async () => {
    renderApp({
      initialPayload: { contentKind: 'plan', content: 'Check [the docs](https://example.com) for details.' },
    });

    const link = await screen.findByRole('link', { name: 'the docs' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('lets a plain click on a link navigate without opening the annotation popover', async () => {
    const user = userEvent.setup();
    renderApp({
      initialPayload: { contentKind: 'plan', content: 'Check [the docs](https://example.com) for details.' },
    });

    const link = await screen.findByRole('link', { name: 'the docs' });
    await waitFor(() => {
      expect(link).toHaveAttribute('data-target-id');
    });

    let defaultPrevented: boolean | undefined;
    link.addEventListener(
      'click',
      (event) => {
        defaultPrevented = event.defaultPrevented;
        event.preventDefault();
      },
      { once: true },
    );

    await user.click(link);

    expect(defaultPrevented).toBe(false);
    expect(screen.queryByTestId(annotationPopoverTestIds.container)).not.toBeInTheDocument();
  });

  it('opens the annotation popover when text inside a link is drag-selected', async () => {
    renderApp({
      initialPayload: { contentKind: 'plan', content: 'Check [the docs](https://example.com) for details.' },
    });

    const link = await screen.findByRole('link', { name: 'the docs' });
    const text = link.firstChild as Text;

    drag({ target: text, from: 0, to: text.length });

    expect(await screen.findByTestId(annotationPopoverTestIds.container)).toBeInTheDocument();
  });

  it('clicking a link that already has an annotation opens the editor instead of navigating', async () => {
    const user = userEvent.setup();
    renderApp({
      initialPayload: { contentKind: 'plan', content: 'Check [the docs](https://example.com) for details.' },
    });

    const link = await screen.findByRole('link', { name: 'the docs' });
    const text = link.firstChild as Text;

    drag({ target: text, from: 0, to: text.length });
    await screen.findByTestId(annotationPopoverTestIds.container);

    await user.type(screen.getByTestId(annotationPopoverTestIds.textarea), 'Link comment');
    await user.click(screen.getByTestId(annotationPopoverTestIds.saveButton));

    await waitFor(() => {
      expect(screen.queryByTestId(annotationPopoverTestIds.container)).not.toBeInTheDocument();
    });

    const rect = link.getBoundingClientRect();
    fireEvent.click(link, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });

    expect(await screen.findByTestId(annotationPopoverTestIds.container)).toBeInTheDocument();
    expect(screen.getByTestId(annotationPopoverTestIds.textarea)).toHaveValue('Link comment');
  });

  it('sets the document title from the payload title', async () => {
    renderApp({
      initialPayload: { contentKind: 'plan', content: '# My Plan\n\nbody', title: 'My Plan' },
    });

    await waitFor(() => {
      expect(document.title).toBe('My Plan — PlanBridge');
    });
  });

  it('falls back to the static title when the payload has no title', async () => {
    renderApp({
      initialPayload: { contentKind: 'plan', content: 'no heading here' },
    });

    await waitFor(() => {
      expect(document.title).toBe('Review — PlanBridge');
    });
  });

  it('uses the basename of metadata.sourcePath in the document title when present', async () => {
    const payload: AnnotationPayload = {
      content: '# A doc\n',
      contentKind: 'document',
      metadata: { entrypoint: 'open_command', sourcePath: '/abs/path/to/draft.md' },
    };
    renderApp({ initialPayload: payload });
    await waitFor(() => {
      expect(document.title).toBe('draft.md — PlanBridge');
    });
  });

  it('falls back to payload title when no sourcePath is set', async () => {
    const payload: AnnotationPayload = {
      content: '# A doc\n',
      contentKind: 'document',
      title: 'A doc',
      metadata: { entrypoint: 'open_command' },
    };
    renderApp({ initialPayload: payload });
    await waitFor(() => {
      expect(document.title).toBe('A doc — PlanBridge');
    });
  });

  it('updates the document title once the fetched payload arrives', async () => {
    const fetchPayload = vi
      .fn<() => Promise<AnnotationPayload>>()
      .mockResolvedValue({ contentKind: 'plan', content: '# Loaded plan', title: 'Loaded plan' });

    renderApp({}, { fetchPayload });

    await waitFor(() => {
      expect(document.title).toBe('Loaded plan — PlanBridge');
    });
  });

  it('does not let a long fenced code block overflow into the sidebar', async () => {
    const longLine = 'x'.repeat(500);
    renderApp({
      initialPayload: {
        contentKind: 'plan',
        content: `# Plan

\`\`\`ts
const a = "${longLine}";
\`\`\`
`,
      },
    });

    const container = await screen.findByTestId(annotatedMarkdownTestIds.container);
    const pre = container.querySelector('pre')!;

    await waitFor(() => {
      expectWithinRightBorder(pre, container);
    });
  });

  it('does not let a long inline code span overflow into the sidebar', async () => {
    const longCode = 'x'.repeat(500);
    renderApp({
      initialPayload: {
        contentKind: 'plan',
        content: `# Plan

Run \`${longCode}\` now.
`,
      },
    });

    const container = await screen.findByTestId(annotatedMarkdownTestIds.container);
    const code = container.querySelector('p code')!;

    await waitFor(() => {
      expectWithinRightBorder(code, container);
    });
  });

  describe('header help menu', () => {
    it('renders documentation, GitHub, and Slack items pointing at the shared link constants', async () => {
      renderApp({ initialPayload: { contentKind: 'plan', content: '# Ready' } });

      await userEvent.click(screen.getByTestId(headerTestIds.helpTrigger));

      expect(await screen.findByTestId(headerTestIds.helpDocsItem)).toHaveAttribute('href', DOCS_URL);
      expect(screen.getByTestId(headerTestIds.helpGithubItem)).toHaveAttribute('href', GITHUB_REPO_URL);
      expect(screen.getByTestId(headerTestIds.helpSlackItem)).toHaveAttribute('href', SLACK_COMMUNITY_URL);
    });

    it('renders a feedback button linking to the feedback page', () => {
      renderApp({ initialPayload: { contentKind: 'plan', content: '# Ready' } });

      const feedbackButton = screen.getByTestId(headerTestIds.feedbackButton);
      expect(feedbackButton).toHaveAttribute('href', FEEDBACK_URL);
      expect(feedbackButton).toHaveAttribute('target', '_blank');
      expect(feedbackButton).toHaveTextContent('Feedback');
    });
  });
});

/** Assert that `child`'s right edge does not extend beyond `parent`'s right border. */
function expectWithinRightBorder(child: Element, parent: Element): void {
  const childRect = child.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  expect(childRect.right).toBeLessThanOrEqual(parentRect.right + 1);
}
