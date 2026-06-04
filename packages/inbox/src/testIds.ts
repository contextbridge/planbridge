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

export const filterBarTestIds = {
  container: 'inbox-filter-bar',
  repoSelect: 'inbox-filter-repo',
  kindToggle: 'inbox-filter-kind',
  timeWindowToggle: 'inbox-filter-time',
  draftsToggle: 'inbox-filter-drafts',
  dependabotToggle: 'inbox-filter-dependabot',
} as const;

export const inboxItemCardTestIds = {
  container: 'inbox-item-card',
  openButton: 'inbox-item-open-button',
  priorityBadge: 'inbox-item-priority-badge',
  reasonBadge: 'inbox-item-reason-badge',
  kindIcon: 'inbox-item-kind-icon',
} as const;

export const prioritySectionTestIds = {
  container: 'inbox-priority-section',
  heading: 'inbox-priority-section-heading',
  count: 'inbox-priority-section-count',
} as const;
