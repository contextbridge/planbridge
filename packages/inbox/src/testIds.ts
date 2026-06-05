export const apiClientTestIds = {
  loadingSpinner: 'inbox-loading-spinner',
} as const;

export const appTestIds = {
  container: 'inbox-app',
  header: 'inbox-header',
  filterBar: 'inbox-filter-bar',
  emptyState: 'inbox-empty-state',
  errorState: 'inbox-error-state',
  refreshButton: 'inbox-refresh-button',
  viewerLogin: 'inbox-viewer-login',
  warningBanner: 'inbox-warning-banner',
} as const;

export const sidebarNavTestIds = {
  container: 'inbox-sidebar-nav',
  sectionButton: (key: string) => `inbox-sidebar-section-${key}`,
} as const;

export const filterBarTestIds = {
  container: 'inbox-filter-bar',
  repoSelect: 'inbox-filter-repo',
  draftsToggle: 'inbox-filter-drafts',
} as const;

export const inboxItemCardTestIds = {
  container: 'inbox-item-card',
  stateBadge: 'inbox-item-state-badge',
  kindIcon: 'inbox-item-kind-icon',
} as const;
