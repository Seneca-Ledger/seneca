import { describe, expect, it } from 'vitest';

import { getWorkspaceTabItems, getWorkspacesRootRedirectPath } from '../workspace-tabs';

describe('workspace tabs helpers', () => {
  it('redirects to overview when active workspace exists', () => {
    expect(getWorkspacesRootRedirectPath(true)).toBe('/workspaces/overview');
  });

  it('redirects to list when active workspace is missing', () => {
    expect(getWorkspacesRootRedirectPath(false)).toBe('/workspaces/list');
  });

  it('builds stable tab metadata with members badge and active item', () => {
    expect(getWorkspaceTabItems('members', 7)).toEqual([
      {
        id: 'overview',
        label: 'Overview',
        href: '/workspaces/overview',
        active: false,
      },
      {
        id: 'members',
        label: 'Members',
        href: '/workspaces/members',
        active: true,
        badge: 7,
      },
      {
        id: 'categories',
        label: 'Categories',
        href: '/workspaces/categories',
        active: false,
      },
    ]);
  });

  it('never returns negative members badge values', () => {
    const items = getWorkspaceTabItems('overview', -4);
    expect(items.find(item => item.id === 'members')?.badge).toBe(0);
  });
});
