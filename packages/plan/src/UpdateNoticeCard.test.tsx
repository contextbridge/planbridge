import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeAppContext } from './testHelpers/createFakeAppContext.ts';
import { UpdateNoticeCard, updateNoticeCardTestIds } from './UpdateNoticeCard.tsx';
import { PlanAppContext } from './useAppContext.ts';

const NOTICE: UpdateNotice = {
  currentVersion: '0.1.0',
  latestVersion: '0.2.0',
  channel: 'stable',
};

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

  it('renders the versions and the contextbridge update command', () => {
    renderCard();
    const container = screen.getByTestId(updateNoticeCardTestIds.container);
    expect(container).toBeInTheDocument();
    expect(container).toHaveTextContent('Update available: v0.2.0');
    expect(container).toHaveTextContent("You're on v0.1.0");
    expect(container).toHaveTextContent('Run to upgrade');
    expect(container).toHaveTextContent('contextbridge update');
  });

  it('fires update_notice_viewed analytics on first render', () => {
    const { analytics } = renderCard();
    const viewed = analytics.captures.find((c) => c.event === 'update_notice_viewed');
    expect(viewed).toBeDefined();
    expect(viewed?.properties).toMatchObject({ latest_version: '0.2.0' });
  });

  it('fires analytics on copy click and does not throw even if clipboard is unavailable', async () => {
    const user = userEvent.setup();
    const { analytics } = renderCard();

    // Click must not throw regardless of the browser's clipboard availability.
    // The handler wraps navigator.clipboard.writeText in try/catch because
    // some proxies strip it in non-secure contexts.
    await user.click(screen.getByTestId(updateNoticeCardTestIds.copyButton));

    const copied = analytics.captures.find((c) => c.event === 'update_command_copied');
    expect(copied).toBeDefined();
    expect(copied?.properties).toMatchObject({ latest_version: '0.2.0' });
  });

  it('calls onDismiss + fires analytics when the × button is clicked', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    const { analytics } = renderCard(NOTICE, onDismiss);

    await user.click(screen.getByTestId(updateNoticeCardTestIds.dismissButton));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(analytics.captures.some((c) => c.event === 'update_notice_dismissed')).toBe(true);
  });
});
