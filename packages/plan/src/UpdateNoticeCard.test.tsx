import type { PerformUpdateResult } from '@contextbridge/shared/performUpdateResultSchema';
import { updateNotice } from '@contextbridge/shared/testFactories';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeAppContext } from './testHelpers/createFakeAppContext.ts';
import { UpdateNoticeCard, updateNoticeCardTestIds } from './UpdateNoticeCard.tsx';
import { PlanAppContext } from './useAppContext.ts';

const NOTICE: UpdateNotice = updateNotice.build();

function renderCard(notice: UpdateNotice = NOTICE, onDismiss: () => void = vi.fn()) {
  const fake = createFakeAppContext();
  const result = render(
    <PlanAppContext.Provider value={fake.context}>
      <UpdateNoticeCard notice={notice} onDismiss={onDismiss} />
    </PlanAppContext.Provider>,
  );
  return { ...fake, result, onDismiss };
}

describe('UpdateNoticeCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the versions', () => {
    renderCard();
    const container = screen.getByTestId(updateNoticeCardTestIds.container);
    expect(container).toBeInTheDocument();
    expect(container).toHaveTextContent('Update available: v0.2.0');
    expect(container).toHaveTextContent("You're on v0.1.0");
  });

  it('fires update_notice_viewed analytics on first render', () => {
    const { analytics } = renderCard();
    const viewed = analytics.captures.find((c) => c.event === 'update_notice_viewed');
    expect(viewed).toBeDefined();
    expect(viewed?.properties).toMatchObject({ latest_version: '0.2.0' });
  });

  it('fires analytics and calls performUpdate on Update Now click', async () => {
    const user = userEvent.setup();
    const { analytics, performUpdate } = renderCard();

    await user.click(screen.getByTestId(updateNoticeCardTestIds.updateButton));

    const clicked = analytics.captures.find((c) => c.event === 'update_now_clicked');
    expect(clicked).toBeDefined();
    expect(clicked?.properties).toMatchObject({ latest_version: '0.2.0' });
    expect(performUpdate).toHaveBeenCalledTimes(1);
  });

  it('shows "Updating…" while the update is in progress', async () => {
    const user = userEvent.setup();
    let resolveUpdate!: (result: PerformUpdateResult) => void;
    const fake = createFakeAppContext();
    fake.performUpdate.mockReturnValue(
      new Promise<PerformUpdateResult>((resolve) => {
        resolveUpdate = resolve;
      }),
    );

    render(
      <PlanAppContext.Provider value={fake.context}>
        <UpdateNoticeCard notice={NOTICE} onDismiss={vi.fn()} />
      </PlanAppContext.Provider>,
    );

    await user.click(screen.getByTestId(updateNoticeCardTestIds.updateButton));
    expect(screen.getByTestId(updateNoticeCardTestIds.updateButton)).toHaveTextContent('Updating…');
    expect(screen.getByTestId(updateNoticeCardTestIds.updateButton)).toBeDisabled();

    resolveUpdate({ status: 'success', message: 'Updated to v0.2.0' });
  });

  it('shows success message and hides button when update succeeds', async () => {
    const user = userEvent.setup();
    const fake = createFakeAppContext();
    fake.performUpdate.mockResolvedValue({ status: 'success', message: 'Updated to v0.2.0' });

    render(
      <PlanAppContext.Provider value={fake.context}>
        <UpdateNoticeCard notice={NOTICE} onDismiss={vi.fn()} />
      </PlanAppContext.Provider>,
    );

    await user.click(screen.getByTestId(updateNoticeCardTestIds.updateButton));
    expect(screen.getByTestId(updateNoticeCardTestIds.statusMessage)).toHaveTextContent('Updated to v0.2.0');
    expect(screen.queryByTestId(updateNoticeCardTestIds.updateButton)).not.toBeInTheDocument();
  });

  it('shows error message and keeps button when update fails', async () => {
    const user = userEvent.setup();
    const fake = createFakeAppContext();
    fake.performUpdate.mockResolvedValue({ status: 'error', message: 'Installation failed.' });

    render(
      <PlanAppContext.Provider value={fake.context}>
        <UpdateNoticeCard notice={NOTICE} onDismiss={vi.fn()} />
      </PlanAppContext.Provider>,
    );

    await user.click(screen.getByTestId(updateNoticeCardTestIds.updateButton));
    expect(screen.getByTestId(updateNoticeCardTestIds.statusMessage)).toHaveTextContent('Installation failed.');
    expect(screen.getByTestId(updateNoticeCardTestIds.updateButton)).toBeInTheDocument();
  });

  it('calls onDismiss + fires analytics when the × button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { analytics } = renderCard(NOTICE, onDismiss);

    await user.click(screen.getByTestId(updateNoticeCardTestIds.dismissButton));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(analytics.captures.some((c) => c.event === 'update_notice_dismissed')).toBe(true);
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

    const clicked = analytics.captures.find((c) => c.event === 'update_changelog_clicked');
    expect(clicked).toBeDefined();
    expect(clicked?.properties).toMatchObject({ latest_version: '0.2.0' });
  });
});
