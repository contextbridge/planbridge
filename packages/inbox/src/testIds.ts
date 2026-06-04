export const apiClientTestIds = {
  loadingSpinner: 'inbox-loading-spinner',
} as const;

export const appTestIds = {
  container: 'inbox-app',
  header: 'inbox-header',
  filterBar: 'inbox-filter-bar',
  prioritySection: 'inbox-priority-section',
  emptyState: 'inbox-empty-state',
  errorState: 'inbox-error-state',
  refreshButton: 'inbox-refresh-button',
  viewerLogin: 'inbox-viewer-login',
  warningBanner: 'inbox-warning-banner',
} as const;

export const pageTabsTestIds = {
  container: 'inbox-page-tabs',
  pullRequestsTab: 'inbox-page-tab-pull-requests',
  issuesTab: 'inbox-page-tab-issues',
} as const;

export const filterBarTestIds = {
  container: 'inbox-filter-bar',
  repoSelect: 'inbox-filter-repo',
  draftsToggle: 'inbox-filter-drafts',
  dependabotToggle: 'inbox-filter-dependabot',
} as const;

export const inboxItemCardTestIds = {
  container: 'inbox-item-card',
  titleLink: 'inbox-item-title-link',
  stateBadge: 'inbox-item-state-badge',
  kindIcon: 'inbox-item-kind-icon',
} as const;

export const prioritySectionTestIds = {
  container: 'inbox-priority-section',
  heading: 'inbox-priority-section-heading',
  count: 'inbox-priority-section-count',
} as const;
