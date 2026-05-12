import { GITHUB_REPO_URL } from '@contextbridge/shared/links';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { UpdateOutcome } from '@contextbridge/shared/updateOutcomeSchema';
import { Alert, AlertDescription, AlertTitle } from '@contextbridge/ui/components/ui/alert';
import { Button } from '@contextbridge/ui/components/ui/button';
import { Loader2, Sparkles, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAnnotationAppContext } from './useAppContext.ts';

const UPDATE_COMMAND = 'contextbridge update';

export const updateNoticeCardTestIds = {
  container: 'update-notice-card',
  updateButton: 'update-notice-card-update',
  updatingIndicator: 'update-notice-card-updating',
  copyFallbackButton: 'update-notice-card-copy-fallback',
  failureMessage: 'update-notice-card-failure-message',
  dismissButton: 'update-notice-card-dismiss',
  changelogLink: 'update-notice-card-changelog',
};

type ReportedOutcome = 'success' | 'failed_recoverable' | 'failed_unrecoverable';

type CardState =
  | { kind: 'idle' }
  | { kind: 'updating' }
  | { kind: 'failed'; message: string; recoverable: boolean };

export interface UpdateNoticeCardProps {
  notice: UpdateNotice;
  onDismiss: () => void;
  onUpdate: () => Promise<UpdateOutcome>;
}

export function UpdateNoticeCard({ notice, onDismiss, onUpdate }: UpdateNoticeCardProps) {
  const { analytics } = useAnnotationAppContext();
  const [state, setState] = useState<CardState>({ kind: 'idle' });

  useEffect(() => {
    analytics.capture('update_notice_viewed', { latest_version: notice.latestVersion });
  }, [analytics, notice.latestVersion]);

  const handleUpdate = async () => {
    analytics.capture('update_triggered', { latest_version: notice.latestVersion });
    setState({ kind: 'updating' });
    const outcome = await onUpdate();
    analytics.capture('update_completed', {
      latest_version: notice.latestVersion,
      outcome: classifyOutcome(outcome),
    });
    if (outcome.status === 'success') {
      onDismiss();
      return;
    }
    setState({ kind: 'failed', message: outcome.message, recoverable: outcome.recoverable });
  };

  const handleCopy = () => {
    analytics.capture('update_command_copied', { latest_version: notice.latestVersion });
    void navigator.clipboard.writeText(UPDATE_COMMAND).catch(() => {});
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
        {state.kind === 'failed' ? (
          <AlertDescription
            data-testid={updateNoticeCardTestIds.failureMessage}
            className="text-muted-foreground text-xs"
          >
            {state.message}
          </AlertDescription>
        ) : (
          <AlertDescription className="text-muted-foreground text-xs">
            You&apos;re on v{notice.currentVersion}.
          </AlertDescription>
        )}
        <div className="col-start-2 mt-1.5 flex items-center justify-end">
          {state.kind === 'idle' ? (
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => void handleUpdate()}
              data-testid={updateNoticeCardTestIds.updateButton}
            >
              Update Now
            </Button>
          ) : null}
          {state.kind === 'updating' ? (
            <Button
              size="sm"
              disabled
              className="h-6 px-2 text-xs"
              data-testid={updateNoticeCardTestIds.updatingIndicator}
            >
              <Loader2 className="size-3 animate-spin" />
              <span className="ml-1">Updating…</span>
            </Button>
          ) : null}
          {state.kind === 'failed' && state.recoverable ? (
            <Button
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleCopy}
              data-testid={updateNoticeCardTestIds.copyFallbackButton}
            >
              Copy Command
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

function classifyOutcome(outcome: UpdateOutcome): ReportedOutcome {
  if (outcome.status === 'success') return 'success';
  return outcome.recoverable ? 'failed_recoverable' : 'failed_unrecoverable';
}
