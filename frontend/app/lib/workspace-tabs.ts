export type WorkspaceTabId = 'overview' | 'members' | 'categories' | 'payees';

type WorkspaceTabItem = {
  id: WorkspaceTabId;
  label: string;
  href: string;
  active: boolean;
  badge?: number;
};

const WORKSPACE_TAB_ROUTES: Record<WorkspaceTabId, string> = {
  overview: '/workspaces/overview',
  members: '/workspaces/members',
  categories: '/workspaces/categories',
  payees: '/workspaces/payees',
};

const WORKSPACE_TAB_LABELS: Record<WorkspaceTabId, string> = {
  overview: 'Overview',
  members: 'Members',
  categories: 'Categories',
  payees: 'Payees',
};

export function getWorkspacesRootRedirectPath(hasCurrentWorkspace: boolean): string {
  return hasCurrentWorkspace ? WORKSPACE_TAB_ROUTES.overview : '/workspaces/list';
}

export function getWorkspaceTabItems(
  activeTab: WorkspaceTabId,
  membersCount: number,
): WorkspaceTabItem[] {
  const normalizedMembersCount = Math.max(0, Number.isFinite(membersCount) ? membersCount : 0);

  return (Object.keys(WORKSPACE_TAB_ROUTES) as WorkspaceTabId[]).map(tabId => ({
    id: tabId,
    label: WORKSPACE_TAB_LABELS[tabId],
    href: WORKSPACE_TAB_ROUTES[tabId],
    active: tabId === activeTab,
    ...(tabId === 'members' ? { badge: normalizedMembersCount } : {}),
  }));
}
