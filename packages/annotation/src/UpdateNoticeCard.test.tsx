import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { UpdateOutcome } from '@contextbridge/shared/updateOutcomeSchema';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeAppContext } from './testHelpers/createFakeAppContext.ts';
import { UpdateNoticeCard, updateNoticeCardTestIds } from './UpdateNoticeCard.tsx';
import { AnnotationAppContext } from './useAppContext.ts';

const NOTICE: UpdateNotice = {
  currentVersion: '0.1.0',
  latestVersion: '0.2.0',
  channel: 'stable',
};

function renderCard(
  opts: {
    notice?: UpdateNotice;
    onDismiss?: () => void;
    onUpdate?: () => Promise<UpdateOutcome>;
  } = {},
) {
  const fake = createFakeAppContext();
  const onDismiss = opts.onDismiss ?? vi.fn();
  const onUpdate = opts.onUpdate ?? vi.fn<() => Promise<UpdateOutcome>>().mockResolvedValue({ status: 'success' });
  const result = render(
    <AnnotationAppContext.Provider value={fake.context}>
      <UpdateNoticeCard notice={opts.notice ?? NOTICE} onDismiss={onDismiss} onUpdate={onUpdate} />
    </AnnotationAppContext.Provider>,
  );
  return { ...fake, result, onDismiss, onUpdate };
}

describe('UpdateNoticeCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the version and a primary Update Now button by default', () => {
    renderCard();
    const container = screen.getByTestId(updateNoticeCardTestIds.container);
    expect(container).toBeInTheDocument();
    expect(container).toHaveTextContent('Update available: v0.2.0');
    expect(container).toHaveTextContent("You're on v0.1.0");
    expect(screen.getByTestId(updateNoticeCardTestIds.updateButton)).toHaveTextContent('Update Now');
  });

  it('fires update_notice_viewed analytics on first render', () => {
    const { analytics } = renderCard();
    const viewed = analytics.captures.find((c) => c.event === 'update_notice_viewed');
    expect(viewed).toBeDefined();
    expect(viewed?.properties).toMatchObject({ latest_version: '0.2.0' });
  });

  it('renders a "What\'s new" link to the per-version GitHub Release page', () => {
    renderCard();
    const link = screen.getByTestId(updateNoticeCardTestIds.changelogLink);
    expect(link).toHaveAttribute('href', 'https://github.com/contextbridge/planbridge/releases/tag/v0.2.0');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('fires update_changelog_clicked analytics when the link is clicked', async () => {
    const user = userEvent.setup();
    const { analytics } = renderCard();

    await user.click(screen.getByTestId(updateNoticeCardTestIds.changelogLink));

    expect(analytics.captures.some((c) => c.event === 'update_changelog_clicked')).toBe(true);
  });

  it('calls onDismiss and fires analytics when the × button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { analytics } = renderCard({ onDismiss });

    await user.click(screen.getByTestId(updateNoticeCardTestIds.dismissButton));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(analytics.captures.some((c) => c.event === 'update_notice_dismissed')).toBe(true);
  });

  it('on Update Now click → fires update_triggered, calls onUpdate, then onDismiss + update_completed=success', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const onUpdate = vi.fn<() => Promise<UpdateOutcome>>().mockResolvedValue({ status: 'success' });
    const { analytics } = renderCard({ onDismiss, onUpdate });

    await user.click(screen.getByTestId(updateNoticeCardTestIds.updateButton));

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(analytics.captures.find((c) => c.event === 'update_triggered')?.properties).toMatchObject({
      latest_version: '0.2.0',
    });
    expect(analytics.captures.find((c) => c.event === 'update_completed')?.properties).toMatchObject({
      latest_version: '0.2.0',
      outcome: 'success',
    });
  });

  it('on recoverable failure → shows the failure message and a Copy Command button', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn<() => Promise<UpdateOutcome>>().mockResolvedValue({
      status: 'failed',
      message: 'Installer failed: brew exited 1',
      recoverable: true,
    });
    const { analytics } = renderCard({ onUpdate });

    await user.click(screen.getByTestId(updateNoticeCardTestIds.updateButton));

    await waitFor(() => {
      expect(screen.getByTestId(updateNoticeCardTestIds.failureMessage)).toHaveTextContent(
        'Installer failed: brew exited 1',
      );
    });
    const copy = screen.getByTestId(updateNoticeCardTestIds.copyFallbackButton);
    expect(copy).toHaveTextContent('Copy Command');
    expect(analytics.captures.find((c) => c.event === 'update_completed')?.properties).toMatchObject({
      outcome: 'failed_recoverable',
    });
  });

  it('clicking the Copy Command fallback writes contextbridge update and fires update_command_copied', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn<() => Promise<UpdateOutcome>>().mockResolvedValue({
      status: 'failed',
      message: 'Installer failed',
      recoverable: true,
    });
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    const { analytics } = renderCard({ onUpdate });

    await user.click(screen.getByTestId(updateNoticeCardTestIds.updateButton));
    await waitFor(() => screen.getByTestId(updateNoticeCardTestIds.copyFallbackButton));
    await user.click(screen.getByTestId(updateNoticeCardTestIds.copyFallbackButton));

    expect(writeText).toHaveBeenCalledWith('contextbridge update');
    expect(analytics.captures.some((c) => c.event === 'update_command_copied')).toBe(true);
    writeText.mockRestore();
  });

  it('on unrecoverable failure → shows the message only, no primary button', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn<() => Promise<UpdateOutcome>>().mockResolvedValue({
      status: 'failed',
      message: 'Updates are disabled for dev builds.',
      recoverable: false,
    });
    const { analytics } = renderCard({ onUpdate });

    await user.click(screen.getByTestId(updateNoticeCardTestIds.updateButton));

    await waitFor(() => {
      expect(screen.getByTestId(updateNoticeCardTestIds.failureMessage)).toHaveTextContent(
        'Updates are disabled for dev builds.',
      );
    });
    expect(screen.queryByTestId(updateNoticeCardTestIds.copyFallbackButton)).toBeNull();
    expect(screen.queryByTestId(updateNoticeCardTestIds.updateButton)).toBeNull();
    expect(analytics.captures.find((c) => c.event === 'update_completed')?.properties).toMatchObject({
      outcome: 'failed_unrecoverable',
    });
  });

  it('shows the spinner while the update is in flight', async () => {
    const user = userEvent.setup();
    let resolveUpdate!: (outcome: UpdateOutcome) => void;
    const onUpdate = vi.fn<() => Promise<UpdateOutcome>>().mockImplementation(
      () =>
        new Promise<UpdateOutcome>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    renderCard({ onUpdate });

    await user.click(screen.getByTestId(updateNoticeCardTestIds.updateButton));

    expect(screen.getByTestId(updateNoticeCardTestIds.updatingIndicator)).toBeInTheDocument();

    resolveUpdate({ status: 'success' });
  });
});
