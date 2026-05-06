import { CircleHelp } from 'lucide-react';
import { BrandMark } from './BrandMark.tsx';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu.tsx';

export const headerTestIds = {
  container: 'cb-header',
  wordmark: 'cb-header-wordmark',
  version: 'cb-header-version',
  helpTrigger: 'cb-header-help-trigger',
  helpMenu: 'cb-header-help-menu',
  helpDocsItem: 'cb-header-help-docs',
  helpGithubItem: 'cb-header-help-github',
  helpSlackItem: 'cb-header-help-slack',
};

export interface HeaderProps {
  version: string;
  docsHref: string;
  githubRepoHref: string;
  slackHelpHref: string;
}

export function Header({ version, docsHref, githubRepoHref, slackHelpHref }: HeaderProps) {
  return (
    <header
      className="sticky top-0 z-50 flex h-11 items-center justify-between border-b border-border bg-background px-4 sm:px-6"
      data-testid={headerTestIds.container}
    >
      <div className="flex items-center gap-2" data-testid={headerTestIds.wordmark}>
        <BrandMark className="size-4 text-foreground" />
        <span className="font-brand text-[15px] font-semibold tracking-tight text-foreground">PlanBridge</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs tabular-nums text-muted-foreground" data-testid={headerTestIds.version}>
          v{version}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Help"
            className="text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
            data-testid={headerTestIds.helpTrigger}
            title="Help"
          >
            <CircleHelp className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" data-testid={headerTestIds.helpMenu}>
            <DropdownMenuItem asChild data-testid={headerTestIds.helpDocsItem}>
              <a href={docsHref} rel="noopener noreferrer" target="_blank">
                Documentation
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid={headerTestIds.helpGithubItem}>
              <a href={githubRepoHref} rel="noopener noreferrer" target="_blank">
                View on GitHub
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem asChild data-testid={headerTestIds.helpSlackItem}>
              <a href={slackHelpHref} rel="noopener noreferrer" target="_blank">
                Get Help in Slack
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
