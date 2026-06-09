import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import { DOCS_URL, FEEDBACK_URL, GITHUB_REPO_URL, SLACK_COMMUNITY_URL } from '@contextbridge/shared/links';
import { annotationThread } from '@contextbridge/shared/testFactories';
import { createDeferred } from '@contextbridge/shared/testHelpers';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { headerTestIds } from '@contextbridge/ui/components/Header';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { annotatedMarkdownTestIds } from './AnnotatedMarkdown.tsx';
import { annotationDraftCommentComposerTestIds } from './AnnotationDraftCommentComposer.tsx';
import { annotationThreadCardTestIds } from './AnnotationThreadCard.tsx';
import { appTestIds } from './App.tsx';
import { commentNavigationBarTestIds } from './CommentNavigationBar.tsx';
import { commentsSidebarTestIds } from './CommentsSidebar.tsx';
import { globalCommentComposerTestIds } from './GlobalCommentComposer.tsx';
import { submitBarTestIds } from './SubmitBar.tsx';
import { drag, pressSubmitShortcut, renderApp } from './testHelpers/index.tsx';
import { updateNoticeCardTestIds } from './UpdateNoticeCard.tsx';

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
    await waitFor(() => {
      expect(getMarkdownElement('h1')).toBeInTheDocument();
    });
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

    expect(screen.getByTestId(appTestIds.emptyState)).toBeInTheDocument();
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
    expect(screen.getByTestId(submitBarTestIds.countdown)).toHaveAttribute('data-countdown-seconds', '3');

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

    expect(await screen.findByTestId(appTestIds.closeReviewDialog)).toBeInTheDocument();
    expect(screen.getByTestId(appTestIds.closeReviewDialogCancelButton)).toBeInTheDocument();
    expect(screen.getByTestId(appTestIds.closeReviewDialogActionButton)).toBeInTheDocument();

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

    expect(await screen.findByTestId(appTestIds.closeReviewDialog)).toBeInTheDocument();
    expect(screen.getByTestId(appTestIds.closeReviewDialogCancelButton)).toBeInTheDocument();
    expect(screen.getByTestId(appTestIds.closeReviewDialogActionButton)).toBeInTheDocument();

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

    const heading = await waitForMarkdownElement('h1');
    await waitFor(() => {
      expect(heading).toHaveAttribute('data-target-id');
    });

    await user.click(heading);
    expect(await screen.findByTestId(annotationDraftCommentComposerTestIds.container)).toBeInTheDocument();

    await user.type(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea), 'Why annotate the heading?');
    await user.click(screen.getByTestId(annotationDraftCommentComposerTestIds.saveButton));

    expect(getLatestCommentCard()).toBeInTheDocument();

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

  it('replaces an empty draft when clicking a different element', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({
      initialPayload: { contentKind: 'plan', content: '# Title\n\nFirst paragraph.\n\nSecond paragraph.' },
    });

    const heading = await waitForMarkdownElement('h1');
    await waitFor(() => {
      expect(heading).toHaveAttribute('data-target-id');
    });
    await user.click(heading);
    await screen.findByTestId(annotationDraftCommentComposerTestIds.container);

    const firstParagraph = getMarkdownParagraph(0);
    await waitFor(() => {
      expect(firstParagraph).toHaveAttribute('data-target-id');
    });
    await user.click(firstParagraph);

    expect(screen.queryByTestId(appTestIds.discardDraftDialog)).not.toBeInTheDocument();

    await user.type(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea), 'Comment on the paragraph');
    await user.click(screen.getByTestId(annotationDraftCommentComposerTestIds.saveButton));
    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(submitAnnotation).toHaveBeenCalledTimes(1);
    });

    const submission = submitAnnotation.mock.calls[0]?.[0];
    expect(submission?.threads).toHaveLength(1);
    const anchor = submission?.threads[0]?.subject.kind === 'annotation' ? submission.threads[0].subject.anchor : null;
    expect(anchor?.quote.exact).toBe('First paragraph.');
  });

  it('prompts to discard a dirty draft when clicking a different element', async () => {
    const user = userEvent.setup();
    renderApp({
      initialPayload: { contentKind: 'plan', content: '# Title\n\nFirst paragraph.\n\nSecond paragraph.' },
    });

    const heading = await waitForMarkdownElement('h1');
    await waitFor(() => {
      expect(heading).toHaveAttribute('data-target-id');
    });
    await user.click(heading);
    await user.type(await screen.findByTestId(annotationDraftCommentComposerTestIds.textarea), 'Heading note');

    const firstParagraph = getMarkdownParagraph(0);
    await waitFor(() => {
      expect(firstParagraph).toHaveAttribute('data-target-id');
    });
    await user.click(firstParagraph);

    expect(await screen.findByTestId(appTestIds.discardDraftDialog)).toBeInTheDocument();

    await user.click(screen.getByTestId(appTestIds.discardDraftDialogCancelButton));
    expect(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea)).toHaveValue('Heading note');

    await user.click(firstParagraph);
    await user.click(await screen.findByTestId(appTestIds.discardDraftDialogActionButton));
    expect(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea)).toHaveValue('');
  });

  it('edits an existing annotation when clicking it while a different empty draft is open', async () => {
    const user = userEvent.setup();
    renderApp({
      initialPayload: { contentKind: 'plan', content: '# Title\n\nFirst paragraph.\n\nSecond paragraph.' },
    });

    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'Heading comment');

    const firstParagraph = getMarkdownParagraph(0);
    await waitFor(() => {
      expect(firstParagraph).toHaveAttribute('data-target-id');
    });
    await user.click(firstParagraph);
    await screen.findByTestId(annotationDraftCommentComposerTestIds.container);

    const heading = getMarkdownElement('h1');
    const rect = heading.getBoundingClientRect();
    fireEvent.click(heading, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });

    await waitFor(() => {
      expect(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea)).toHaveValue('Heading comment');
    });
  });

  it('uses the generic discard workflow before submitting with an unsaved annotation draft', async () => {
    const user = userEvent.setup();
    const { submitAnnotation } = renderApp({
      initialPayload: { contentKind: 'plan', content: '# Title\n\nExplain the parser ordering.' },
    });

    const heading = await waitForMarkdownElement('h1');
    await waitFor(() => {
      expect(heading).toHaveAttribute('data-target-id');
    });

    await user.click(heading);
    await user.type(await screen.findByTestId(annotationDraftCommentComposerTestIds.textarea), 'Unsaved annotation');
    await user.click(screen.getByTestId(submitBarTestIds.button));

    expect(await screen.findByTestId(appTestIds.discardDraftDialog)).toBeInTheDocument();
    expect(screen.getByTestId(appTestIds.discardDraftDialog)).toBeInTheDocument();
    expect(submitAnnotation).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(appTestIds.discardDraftDialogCancelButton));

    expect(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea)).toHaveValue('Unsaved annotation');
    expect(submitAnnotation).not.toHaveBeenCalled();

    await user.click(screen.getByTestId(submitBarTestIds.button));
    await user.click(await screen.findByTestId(appTestIds.discardDraftDialogActionButton));
    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(submitAnnotation).toHaveBeenCalledTimes(1);
    });
    expect(submitAnnotation.mock.calls[0]?.[0]).toMatchObject({
      status: 'approved',
      threads: [],
    });
  });

  it('opens the discard dialog on Escape and keeps the draft when Escape dismisses the dialog', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: '# Title\n\nExplain the parser ordering.' } });

    await user.click(await waitForMarkdownElement('h1'));
    await user.type(await screen.findByTestId(annotationDraftCommentComposerTestIds.textarea), 'Unsaved annotation');

    fireEvent.keyDown(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea), {
      code: 'Escape',
      key: 'Escape',
    });
    expect(await screen.findByTestId(appTestIds.discardDraftDialog)).toBeInTheDocument();
    expect(screen.getByTestId(annotationDraftCommentComposerTestIds.container)).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId(appTestIds.discardDraftDialog), { code: 'Escape', key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByTestId(appTestIds.discardDraftDialog)).not.toBeInTheDocument();
    });
    expect(screen.getByTestId(annotationDraftCommentComposerTestIds.container)).toBeInTheDocument();
    expect(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea)).toHaveValue('Unsaved annotation');
  });

  it('updates the visible countdown after submission without waiting on real timers', async () => {
    const user = userEvent.setup();
    const { browser } = renderApp({ initialPayload: { contentKind: 'plan', content: '# Ship it' } });

    await user.click(screen.getByTestId(submitBarTestIds.button));

    expect(await screen.findByTestId(submitBarTestIds.countdown)).toHaveAttribute('data-countdown-seconds', '3');

    act(() => browser.advance());
    expect(screen.getByTestId(submitBarTestIds.countdown)).toHaveAttribute('data-countdown-seconds', '2');
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

    const pre = await waitForMarkdownElement('pre');

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
      expect(getMarkdownElement('pre code.hljs .hljs-string')).not.toBeNull();
    });

    const stringToken = getMarkdownElement<HTMLElement>('pre code.hljs .hljs-string');
    const text = stringToken.firstChild as Text;

    drag({ target: text, from: 3, to: 5 });

    await screen.findByTestId(annotationDraftCommentComposerTestIds.container);

    await user.type(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea), 'this literal is too long');
    await user.click(screen.getByTestId(annotationDraftCommentComposerTestIds.saveButton));
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
      expect(getMarkdownElement('pre code.hljs .hljs-string')).not.toBeNull();
    });

    const stringToken = getMarkdownElement<HTMLElement>('pre code.hljs .hljs-string');
    await user.click(stringToken);

    await screen.findByTestId(annotationDraftCommentComposerTestIds.container);
    await user.type(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea), 'too long');
    await user.click(screen.getByTestId(annotationDraftCommentComposerTestIds.saveButton));
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

    const link = await waitForMarkdownElement<HTMLAnchorElement>('a');
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('lets a plain click on a link navigate without opening the annotation popover', async () => {
    const user = userEvent.setup();
    renderApp({
      initialPayload: { contentKind: 'plan', content: 'Check [the docs](https://example.com) for details.' },
    });

    const link = await waitForMarkdownElement<HTMLAnchorElement>('a');
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
    expect(screen.queryByTestId(annotationDraftCommentComposerTestIds.container)).not.toBeInTheDocument();
  });

  it('opens the annotation popover when text inside a link is drag-selected', async () => {
    renderApp({
      initialPayload: { contentKind: 'plan', content: 'Check [the docs](https://example.com) for details.' },
    });

    const link = await waitForMarkdownElement<HTMLAnchorElement>('a');
    const text = link.firstChild as Text;

    drag({ target: text, from: 0, to: text.length });

    expect(await screen.findByTestId(annotationDraftCommentComposerTestIds.container)).toBeInTheDocument();
  });

  it('clicking a link that already has an annotation opens the editor instead of navigating', async () => {
    const user = userEvent.setup();
    renderApp({
      initialPayload: { contentKind: 'plan', content: 'Check [the docs](https://example.com) for details.' },
    });

    const link = await waitForMarkdownElement<HTMLAnchorElement>('a');
    const text = link.firstChild as Text;

    drag({ target: text, from: 0, to: text.length });
    await screen.findByTestId(annotationDraftCommentComposerTestIds.container);

    await user.type(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea), 'Link comment');
    await user.click(screen.getByTestId(annotationDraftCommentComposerTestIds.saveButton));

    await waitFor(() => {
      expect(screen.queryByTestId(annotationDraftCommentComposerTestIds.container)).not.toBeInTheDocument();
    });

    const rect = link.getBoundingClientRect();
    fireEvent.click(link, {
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });

    expect(await screen.findByTestId(annotationDraftCommentComposerTestIds.container)).toBeInTheDocument();
    expect(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea)).toHaveValue('Link comment');
  });

  it('renders top comment navigation after annotation comments exist', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: '# First\n\nSecond paragraph.' } });

    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'First comment');

    expect(screen.getByTestId(commentNavigationBarTestIds.container)).toBeInTheDocument();
    expectCommentCounter({ activePosition: 1, total: 1 });
  });

  it('navigates comments with J and K keyboard shortcuts and wraps at the ends', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: '# First\n\nSecond paragraph.\n\nThird paragraph.' } });

    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'First comment');
    await saveAnnotationOnElement(user, getMarkdownParagraph(0), 'Second comment');
    await saveAnnotationOnElement(user, getMarkdownParagraph(1), 'Third comment');

    expectCommentCounter({ activePosition: 1, total: 3 });

    pressCommentShortcut('j');
    expectCommentCounter({ activePosition: 2, total: 3 });
    expect(getCurrentCommentCard()).toBe(getCommentCardAt(1));

    pressCommentShortcut('k');
    expectCommentCounter({ activePosition: 1, total: 3 });

    pressCommentShortcut('k');
    expectCommentCounter({ activePosition: 3, total: 3 });
    expect(getCurrentCommentCard()).toBe(getCommentCardAt(2));
  });

  it('moves the active sidebar border to a new draft opened from a markdown selection', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: '# First\n\nSecond paragraph.\n\nThird paragraph.' } });

    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'First comment');
    await saveAnnotationOnElement(user, getMarkdownParagraph(0), 'Second comment');

    pressCommentShortcut('j');
    const selectedCard = getCurrentCommentCard();
    expect(selectedCard).toHaveClass('border-chart-3/70');

    const thirdParagraph = getMarkdownParagraph(1);
    drag({ target: thirdParagraph.firstChild as Text, from: 0, to: 'Third'.length });

    const draftCard = (await screen.findByTestId(annotationDraftCommentComposerTestIds.container)).closest(
      '[role="button"]',
    );
    if (!(draftCard instanceof HTMLElement)) {
      throw new Error('Expected draft composer to be inside a thread card');
    }

    expect(draftCard).toHaveAttribute('aria-current', 'true');
    expect(draftCard).toHaveClass('border-chart-3/70');
    expect(draftCard).toHaveClass('cb-draft-thread-attention');
    expect(selectedCard).not.toHaveClass('border-chart-3/70');
  });

  it('navigates comments in document order even when comments were created out of order', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: '# First\n\nSecond paragraph.\n\nThird paragraph.' } });

    await saveAnnotationOnElement(user, await waitForMarkdownParagraph(1), 'Third comment');
    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'First comment');
    await saveAnnotationOnElement(user, getMarkdownParagraph(0), 'Second comment');

    expectCommentCounter({ activePosition: 1, total: 3 });
    expect(getCurrentCommentCard()).toBe(getCommentCardAt(0));

    pressCommentShortcut('j');
    expectCommentCounter({ activePosition: 2, total: 3 });
    expect(getCurrentCommentCard()).toBe(getCommentCardAt(1));

    pressCommentShortcut('j');
    expectCommentCounter({ activePosition: 3, total: 3 });
    expect(getCurrentCommentCard()).toBe(getCommentCardAt(2));

    pressCommentShortcut('j');
    expectCommentCounter({ activePosition: 1, total: 3 });
    expect(getCurrentCommentCard()).toBe(getCommentCardAt(0));
  });

  it('keeps keyboard navigation highlighting after saving a hovered draft thread', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: '# First\n\nSecond paragraph.' } });

    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'First comment');

    const secondParagraph = getMarkdownParagraph(0);
    await waitFor(() => {
      expect(secondParagraph).toHaveAttribute('data-target-id');
    });
    await user.click(secondParagraph);
    const draftCard = (await screen.findByTestId(annotationDraftCommentComposerTestIds.container)).closest(
      '[role="button"]',
    );
    if (!(draftCard instanceof HTMLElement)) {
      throw new Error('Expected draft composer to be inside a thread card');
    }
    fireEvent.mouseEnter(draftCard);
    await user.type(screen.getByTestId(annotationDraftCommentComposerTestIds.textarea), 'Second comment');
    await user.click(screen.getByTestId(annotationDraftCommentComposerTestIds.saveButton));

    pressCommentShortcut('j');

    expectCommentCounter({ activePosition: 2, total: 2 });
    expect(getCurrentCommentCard()).toBe(getCommentCardAt(1));
  });

  it('keeps keyboard navigation highlighting after saving an edited hovered thread', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: '# First\n\nSecond paragraph.' } });

    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'First comment');
    await saveAnnotationOnElement(user, getMarkdownParagraph(0), 'Second comment');

    const firstCard = getCommentCardAt(0);
    fireEvent.mouseEnter(firstCard);
    await user.click(firstCard);
    const textarea = await findAnnotationTextarea();
    await user.clear(textarea);
    await user.type(textarea, 'First comment edited');
    await user.click(screen.getByTestId(annotationDraftCommentComposerTestIds.saveButton));

    pressCommentShortcut('j');

    expectCommentCounter({ activePosition: 2, total: 2 });
    expect(getCurrentCommentCard()).toBe(getCommentCardAt(1));
  });

  it('handles comment shortcuts before Storybook-style handlers can stop propagation', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: '# First\n\nSecond paragraph.' } });

    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'First comment');
    await saveAnnotationOnElement(user, getMarkdownParagraph(0), 'Second comment');

    const ownerDocument = screen.getByTestId(appTestIds.container).ownerDocument;
    ownerDocument.body.addEventListener('keydown', (event) => event.stopPropagation(), { once: true });

    fireEvent.keyDown(ownerDocument.body, { key: 'j', code: 'KeyJ' });

    expectCommentCounter({ activePosition: 2, total: 2 });
  });

  it('opens the current comment editor with C and closes it with Escape', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: '# First\n\nSecond paragraph.' } });

    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'First comment');
    await saveAnnotationOnElement(user, getMarkdownParagraph(0), 'Second comment');

    pressCommentShortcut('j');
    pressCommentShortcut('c');

    const textarea = await findAnnotationTextarea();
    expect(textarea).toHaveFocus();
    expect(textarea).toHaveValue('Second comment');
    await waitFor(() => {
      expect(textarea.selectionStart).toBe('Second comment'.length);
      expect(textarea.selectionEnd).toBe('Second comment'.length);
    });
    expect(screen.queryByTestId(commentNavigationBarTestIds.container)).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByTestId(annotationDraftCommentComposerTestIds.container)).not.toBeInTheDocument();
    });
  });

  it('ignores comment navigation shortcuts inside editable fields', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { contentKind: 'plan', content: '# First\n\nSecond paragraph.' } });

    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'First comment');
    await saveAnnotationOnElement(user, getMarkdownParagraph(0), 'Second comment');

    const textarea = screen.getByTestId(globalCommentComposerTestIds.textarea);
    await user.click(textarea);
    await user.keyboard('jkc');

    expect(textarea).toHaveValue('jkc');
    expectCommentCounter({ activePosition: 1, total: 2 });
  });

  it('keeps unresolved comments visible but excludes them from navigation', async () => {
    const user = userEvent.setup();
    const unresolvedThread = annotationThread.build({
      id: 'thr_unresolved',
      messages: [
        {
          author: { id: 'local-user', kind: 'user', displayName: 'You' },
          body: 'Unresolved soon',
          createdAt: '2026-04-20T12:34:56.000Z',
          id: 'msg_unresolved',
        },
      ],
    });
    renderApp({ initialPayload: { contentKind: 'plan', content: '# First' }, initialThreads: [unresolvedThread] });

    await saveAnnotationOnElement(user, await waitForMarkdownElement('h1'), 'First comment');

    expectCommentCounter({ activePosition: 1, total: 1 });
    expect(screen.getByTestId(annotationThreadCardTestIds.card('thr_unresolved'))).toBeInTheDocument();
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
      expect(feedbackButton).toBeInTheDocument();
    });
  });
});

/** Assert that `child`'s right edge does not extend beyond `parent`'s right border. */
function expectWithinRightBorder(child: Element, parent: Element): void {
  const childRect = child.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  expect(childRect.right).toBeLessThanOrEqual(parentRect.right + 1);
}

function expectCommentCounter({ activePosition, total }: { activePosition: number; total: number }): void {
  const counter = screen.getByTestId(commentsSidebarTestIds.counter);
  expect(counter).toHaveAttribute('data-comment-active-position', String(activePosition));
  expect(counter).toHaveAttribute('data-comment-total', String(total));
}

async function saveAnnotationOnElement(
  user: ReturnType<typeof userEvent.setup>,
  element: HTMLElement,
  body: string,
): Promise<void> {
  await waitFor(() => {
    expect(element).toHaveAttribute('data-target-id');
  });

  await user.click(element);
  await user.type(await screen.findByTestId(annotationDraftCommentComposerTestIds.textarea), body);
  await user.click(screen.getByTestId(annotationDraftCommentComposerTestIds.saveButton));
  await waitFor(() => {
    expect(screen.queryByTestId(annotationDraftCommentComposerTestIds.container)).not.toBeInTheDocument();
  });
}

async function findAnnotationTextarea(): Promise<HTMLTextAreaElement> {
  const textarea = await screen.findByTestId(annotationDraftCommentComposerTestIds.textarea);
  if (!(textarea instanceof HTMLTextAreaElement)) {
    throw new Error('Expected annotation popover control to be a textarea');
  }

  return textarea;
}

function getMarkdownElement<T extends HTMLElement = HTMLElement>(selector: string): T {
  const element = screen.getByTestId(annotatedMarkdownTestIds.container).querySelector<T>(selector);
  if (!element) {
    throw new Error(`Could not find markdown element matching ${selector}`);
  }

  return element;
}

async function waitForMarkdownElement<T extends HTMLElement = HTMLElement>(selector: string): Promise<T> {
  return await waitFor(() => getMarkdownElement<T>(selector));
}

function getMarkdownParagraph(index: number): HTMLElement {
  const paragraph = screen.getByTestId(annotatedMarkdownTestIds.container).querySelectorAll<HTMLElement>('p')[index];
  if (!paragraph) {
    throw new Error(`Could not find markdown paragraph at index ${index}`);
  }

  return paragraph;
}

async function waitForMarkdownParagraph(index: number): Promise<HTMLElement> {
  return await waitFor(() => getMarkdownParagraph(index));
}

function getCommentCards(): HTMLElement[] {
  const cardTestIdPrefix = annotationThreadCardTestIds.card('');
  return Array.from(
    screen
      .getByTestId(commentsSidebarTestIds.threadList)
      .querySelectorAll<HTMLElement>(`[data-testid^="${cardTestIdPrefix}"]`),
  );
}

function getCommentCardAt(index: number): HTMLElement {
  const card = getCommentCards()[index];
  if (!card) {
    throw new Error(`Could not find comment card at index ${index}`);
  }

  return card;
}

function getCurrentCommentCard(): HTMLElement {
  const cardTestIdPrefix = annotationThreadCardTestIds.card('');
  const card = screen
    .getByTestId(commentsSidebarTestIds.threadList)
    .querySelector<HTMLElement>(`[data-testid^="${cardTestIdPrefix}"][aria-current="true"]`);
  if (!card) {
    throw new Error('Could not find current comment card');
  }

  return card;
}

function getLatestCommentCard(): HTMLElement {
  const cards = getCommentCards();
  const card = cards.at(-1);
  if (!card) {
    throw new Error('Could not find a comment card');
  }

  return card;
}

function pressCommentShortcut(key: 'c' | 'j' | 'k'): void {
  const ownerDocument = screen.getByTestId(appTestIds.container).ownerDocument;
  fireEvent.keyDown(ownerDocument.body, { key, code: `Key${key.toUpperCase()}` });
}
