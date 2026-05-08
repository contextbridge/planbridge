import { DOCS_URL, GITHUB_REPO_URL, SLACK_COMMUNITY_URL } from '@contextbridge/shared/links';
import type { SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { headerTestIds } from '@contextbridge/ui/components/Header';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { annotationPopoverTestIds } from './AnnotationPopover.tsx';
import { appTestIds } from './App.tsx';
import { globalCommentComposerTestIds } from './GlobalCommentComposer.tsx';
import { markdownPlanTestIds } from './MarkdownPlan.tsx';
import { submitBarTestIds } from './SubmitBar.tsx';
import { renderApp } from './testHelpers/renderApp.tsx';
import { updateNoticeCardTestIds } from './UpdateNoticeCard.tsx';

describe('App', () => {
  afterEach(() => {
    cleanup();
  });

  it('loads payload content via the injected fetchPayload', async () => {
    const fetchPayload = vi
      .fn<() => Promise<SubmissionPayload>>()
      .mockResolvedValue({ content: '# Loaded plan\n\nStep 1', title: 'Loaded plan' });

    const { analytics } = renderApp({}, { fetchPayload });

    expect(screen.getByTestId(appTestIds.loading)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 1, name: 'Loaded plan' })).toBeInTheDocument();
    expect(fetchPayload).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(analytics.captures.some((c) => c.event === 'plan_review_viewed')).toBe(true);
    });
  });

  it('captures plan_review_viewed when an initial payload is supplied', () => {
    const { analytics } = renderApp({ initialPayload: { content: '# Ready' } });
    const viewed = analytics.captures.find((c) => c.event === 'plan_review_viewed');
    expect(viewed).toBeDefined();
    expect(viewed?.properties?.['bytes']).toBe('# Ready'.length);
  });

  it('shows an empty state when the plan content is blank', () => {
    renderApp({ initialPayload: { content: '' } });

    expect(screen.getByTestId(appTestIds.emptyState)).toHaveTextContent('No plan content was provided.');
  });

  it('renders the update-notice card when /update-notice resolves with a notice', async () => {
    const notice: UpdateNotice = { currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' };
    const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(notice);
    renderApp({ initialPayload: { content: '# Ready' } }, { fetchUpdateNotice });

    expect(await screen.findByTestId(updateNoticeCardTestIds.container)).toBeInTheDocument();
  });

  it('does not render the card when /update-notice resolves null', async () => {
    const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(null);
    renderApp({ initialPayload: { content: '# Ready' } }, { fetchUpdateNotice });

    await waitFor(() => {
      expect(fetchUpdateNotice).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByTestId(updateNoticeCardTestIds.container)).not.toBeInTheDocument();
  });

  it('dismisses the card and keeps it hidden when × is clicked', async () => {
    const user = userEvent.setup();
    const notice: UpdateNotice = { currentVersion: '0.1.0', latestVersion: '0.2.0', channel: 'stable' };
    const fetchUpdateNotice = vi.fn<() => Promise<UpdateNotice | null>>().mockResolvedValue(notice);
    renderApp({ initialPayload: { content: '# Ready' } }, { fetchUpdateNotice });

    const card = await screen.findByTestId(updateNoticeCardTestIds.container);
    expect(card).toBeInTheDocument();

    await user.click(screen.getByTestId(updateNoticeCardTestIds.dismissButton));

    expect(screen.queryByTestId(updateNoticeCardTestIds.container)).not.toBeInTheDocument();
  });

  it('submits a global comment typed into the composer as a global thread', async () => {
    const user = userEvent.setup();
    const { submitPlanReview, timers } = renderApp({ initialPayload: { content: '# Ship it' } });

    await user.type(screen.getByTestId(globalCommentComposerTestIds.textarea), 'Please spell out rollback steps');

    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(submitPlanReview).toHaveBeenCalledTimes(1);
    });

    const submission = submitPlanReview.mock.calls[0]?.[0];
    expect(submission?.status).toBe('changes_requested');
    expect(submission?.threads).toHaveLength(1);
    expect(submission?.threads[0]?.subject.kind).toBe('global');
    expect(submission?.threads[0]?.messages[0]?.body).toBe('Please spell out rollback steps');
    expect(screen.getByTestId(submitBarTestIds.countdown)).toHaveTextContent('This window will close in 3 seconds.');

    act(() => timers.advance());
    act(() => timers.advance());
    act(() => timers.advance());
    expect(timers.closeWindow).toHaveBeenCalledTimes(1);
  });

  it('opens an annotation draft from a clicked target and submits it', async () => {
    const user = userEvent.setup();
    const { submitPlanReview } = renderApp({
      initialPayload: { content: '# Title\n\nExplain the parser ordering.' },
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
      expect(submitPlanReview).toHaveBeenCalledTimes(1);
    });

    const submission = submitPlanReview.mock.calls[0]?.[0];
    expect(submission?.status).toBe('changes_requested');
    expect(submission?.threads).toHaveLength(1);
    expect(submission?.threads[0]?.subject.kind).toBe('annotation');
    expect(submission?.threads[0]?.messages[0]?.body).toBe('Why annotate the heading?');
  });

  it('updates the visible countdown after submission without waiting on real timers', async () => {
    const user = userEvent.setup();
    const { timers } = renderApp({ initialPayload: { content: '# Ship it' } });

    await user.click(screen.getByTestId(submitBarTestIds.button));

    expect(await screen.findByTestId(submitBarTestIds.countdown)).toHaveTextContent(
      'This window will close in 3 seconds.',
    );

    act(() => timers.advance());
    expect(screen.getByTestId(submitBarTestIds.countdown)).toHaveTextContent('This window will close in 2 seconds.');
  });

  it('shows Codex-specific handoff notice on approval when source is hook_codex', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { content: '# Ship it', metadata: { source: 'hook_codex' } } });

    await user.click(screen.getByTestId(submitBarTestIds.button));

    expect(await screen.findByTestId(submitBarTestIds.countdown)).toHaveTextContent(
      'Plan approved. Return to Codex to confirm implementation. This window will close in 3 seconds.',
    );
  });

  it('shows default countdown for hook_codex when changes are requested', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { content: '# Ship it', metadata: { source: 'hook_codex' } } });

    await user.type(screen.getByTestId(globalCommentComposerTestIds.textarea), 'Needs work');
    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(screen.getByTestId(submitBarTestIds.countdown)).toHaveTextContent(
        'This window will close in 3 seconds.',
      );
    });
    expect(screen.getByTestId(submitBarTestIds.countdown)).not.toHaveTextContent('Return to Codex');
  });

  it('shows default countdown for hook_claude approval', async () => {
    const user = userEvent.setup();
    renderApp({ initialPayload: { content: '# Ship it', metadata: { source: 'hook_claude' } } });

    await user.click(screen.getByTestId(submitBarTestIds.button));

    expect(await screen.findByTestId(submitBarTestIds.countdown)).toHaveTextContent(
      'This window will close in 3 seconds.',
    );
    expect(screen.getByTestId(submitBarTestIds.countdown)).not.toHaveTextContent('Return to Codex');
  });

  it('syntax-highlights fenced code blocks with hljs token spans', async () => {
    renderApp({
      initialPayload: { content: '# Plan\n\n```ts\nconst greeting = "hello";\n```\n' },
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
    const { submitPlanReview } = renderApp({
      initialPayload: { content: '```ts\nconst greeting = "helloWorld";\n```\n' },
    });

    await waitFor(() => {
      expect(document.querySelector('pre code.hljs .hljs-string')).not.toBeNull();
    });

    const stringToken = document.querySelector<HTMLElement>('pre code.hljs .hljs-string')!;
    const text = stringToken.firstChild as Text;

    const range = document.createRange();
    range.setStart(text, 3);
    range.setEnd(text, 5);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    fireEvent.mouseUp(screen.getByTestId(markdownPlanTestIds.container));

    await screen.findByTestId(annotationPopoverTestIds.container);

    await user.type(screen.getByTestId(annotationPopoverTestIds.textarea), 'this literal is too long');
    await user.click(screen.getByTestId(annotationPopoverTestIds.saveButton));
    await user.click(screen.getByTestId(submitBarTestIds.button));

    await waitFor(() => {
      expect(submitPlanReview).toHaveBeenCalledTimes(1);
    });

    const submission = submitPlanReview.mock.calls[0]?.[0];
    expect(submission?.threads).toHaveLength(1);
    const anchor = submission?.threads[0]?.subject.kind === 'annotation' ? submission.threads[0].subject.anchor : null;
    expect(anchor?.quote.exact).toBe('"helloWorld"');
  });

  it('scopes a code-token click to just the token, not the whole block', async () => {
    const user = userEvent.setup();
    const { submitPlanReview } = renderApp({
      initialPayload: { content: '```ts\nconst greeting = "hello";\n```\n' },
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
      expect(submitPlanReview).toHaveBeenCalledTimes(1);
    });

    const submission = submitPlanReview.mock.calls[0]?.[0];
    const anchor = submission?.threads[0]?.subject.kind === 'annotation' ? submission.threads[0].subject.anchor : null;
    expect(anchor?.quote.exact).toBe('"hello"');
  });

  it('renders markdown links with target="_blank" and rel="noreferrer"', async () => {
    renderApp({
      initialPayload: { content: 'Check [the docs](https://example.com) for details.' },
    });

    const link = await screen.findByRole('link', { name: 'the docs' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('sets the document title from the payload title', async () => {
    renderApp({
      initialPayload: { content: '# My Plan\n\nbody', title: 'My Plan' },
    });

    await waitFor(() => {
      expect(document.title).toBe('My Plan — PlanBridge');
    });
  });

  it('falls back to the static title when the payload has no title', async () => {
    renderApp({
      initialPayload: { content: 'no heading here' },
    });

    await waitFor(() => {
      expect(document.title).toBe('Plan Review — PlanBridge');
    });
  });

  it('updates the document title once the fetched payload arrives', async () => {
    const fetchPayload = vi
      .fn<() => Promise<SubmissionPayload>>()
      .mockResolvedValue({ content: '# Loaded plan', title: 'Loaded plan' });

    renderApp({}, { fetchPayload });

    await waitFor(() => {
      expect(document.title).toBe('Loaded plan — PlanBridge');
    });
  });

  it('does not let a long fenced code block overflow into the sidebar', async () => {
    const longLine = 'x'.repeat(500);
    renderApp({
      initialPayload: {
        content: `# Plan

\`\`\`ts
const a = "${longLine}";
\`\`\`
`,
      },
    });

    const container = await screen.findByTestId(markdownPlanTestIds.container);
    const pre = container.querySelector('pre')!;

    await waitFor(() => {
      expectWithinRightBorder(pre, container);
    });
  });

  it('does not let a long inline code span overflow into the sidebar', async () => {
    const longCode = 'x'.repeat(500);
    renderApp({
      initialPayload: {
        content: `# Plan

Run \`${longCode}\` now.
`,
      },
    });

    const container = await screen.findByTestId(markdownPlanTestIds.container);
    const code = container.querySelector('p code')!;

    await waitFor(() => {
      expectWithinRightBorder(code, container);
    });
  });

  describe('header help menu', () => {
    it('renders documentation, GitHub, and Slack items pointing at the shared link constants', async () => {
      renderApp({ initialPayload: { content: '# Ready' } });

      await userEvent.click(screen.getByTestId(headerTestIds.helpTrigger));

      expect(await screen.findByTestId(headerTestIds.helpDocsItem)).toHaveAttribute('href', DOCS_URL);
      expect(screen.getByTestId(headerTestIds.helpGithubItem)).toHaveAttribute('href', GITHUB_REPO_URL);
      expect(screen.getByTestId(headerTestIds.helpSlackItem)).toHaveAttribute('href', SLACK_COMMUNITY_URL);
    });
  });
});

/** Assert that `child`'s right edge does not extend beyond `parent`'s right border. */
function expectWithinRightBorder(child: Element, parent: Element): void {
  const childRect = child.getBoundingClientRect();
  const parentRect = parent.getBoundingClientRect();
  expect(childRect.right).toBeLessThanOrEqual(parentRect.right + 1);
}
