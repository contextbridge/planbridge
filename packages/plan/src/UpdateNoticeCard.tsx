import { GITHUB_REPO_URL } from '@contextbridge/shared/links';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { Alert, AlertDescription, AlertTitle } from '@contextbridge/ui/components/ui/alert';
import { Button } from '@contextbridge/ui/components/ui/button';
import { Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePlanAppContext } from './useAppContext.ts';

type UpdateState = 'idle' | 'updating' | 'success' | 'error';

export const updateNoticeCardTestIds = {
  container: 'update-notice-card',
  updateButton: 'update-notice-card-update',
  dismissButton: 'update-notice-card-dismiss',
  changelogLink: 'update-notice-card-changelog',
  statusMessage: 'update-notice-card-status',
};

export interface UpdateNoticeCardProps {
  notice: UpdateNotice;
  onDismiss: () => void;
}

export function UpdateNoticeCard({ notice, onDismiss }: UpdateNoticeCardProps) {
  const { analytics, performUpdate } = usePlanAppContext();
  const [updateState, setUpdateState] = useState<UpdateState>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    analytics.capture('update_notice_viewed', { latest_version: notice.latestVersion });
  }, [analytics, notice.latestVersion]);

  const handleUpdate = () => {
    analytics.capture('update_now_clicked', { latest_version: notice.latestVersion });
    setUpdateState('updating');
    setStatusMessage('');

    void performUpdate().then((result) => {
      if (result.status === 'success') {
        setUpdateState('success');
        setStatusMessage(result.message);
      } else {
        setUpdateState('error');
        setStatusMessage(result.message);
      }
    });
  };

  const handleDismiss = () => {
    analytics.capture('update_notice_dismissed', { latest_version: notice.latestVersion });
    onDismiss();
  };

  const handleChangelogClick = () => {
    analytics.capture('update_changelog_clicked', { latest_version: notice.latestVersion });
  };

  return (
    <div className="fixed right-4 bottom-4 z-50 w-[min(20rem,calc(100vw-2rem))]">
      <Alert data-testid={updateNoticeCardTestIds.container} className="relative py-2.5 pr-8 shadow-lg">
        <Sparkles className="size-3.5" />
        <AlertTitle className="text-xs font-medium">
          Update available:{' '}
          <a
            href={`${GITHUB_REPO_URL}/releases/tag/v${notice.latestVersion}`}
            target="_blank"
            rel="noreferrer noopener"
            onClick={handleChangelogClick}
            data-testid={updateNoticeCardTestIds.changelogLink}
            className="underline-offset-2 hover:underline"
          >
            v{notice.latestVersion}
          </a>
        </AlertTitle>
        <AlertDescription className="text-muted-foreground text-xs">
          You&apos;re on v{notice.currentVersion}.
        </AlertDescription>
        <div className="col-start-2 mt-1.5 flex items-center gap-1.5">
          {statusMessage ? (
            <span
              className="flex-1 truncate text-xs text-muted-foreground"
              data-testid={updateNoticeCardTestIds.statusMessage}
            >
              {statusMessage}
            </span>
          ) : null}
          {updateState !== 'success' ? (
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleUpdate}
              disabled={updateState === 'updating'}
              data-testid={updateNoticeCardTestIds.updateButton}
            >
              {updateState === 'updating' ? 'Updating…' : 'Update Now'}
            </Button>
          ) : null}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground absolute top-1 right-1 size-5"
          onClick={handleDismiss}
          data-testid={updateNoticeCardTestIds.dismissButton}
          aria-label="Dismiss update notice"
        >
          <X className="size-3" />
        </Button>
      </Alert>
    </div>
  );
}
