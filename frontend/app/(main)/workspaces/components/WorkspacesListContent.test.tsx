import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const pushMock = vi.hoisted(() => vi.fn());

const workspaceState = {
  workspaces: [
    {
      id: 'ws-1',
      name: 'Main Workspace',
      description: 'Workspace description',
      isFavorite: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  loading: false,
  switchWorkspace: vi.fn(),
  refreshWorkspaces: vi.fn(),
};

vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    loading: 'Loading...',
    noWorkspaces: 'No workspaces',
    createWorkspace: 'Create Workspace',
    searchPlaceholder: 'Search workspaces...',
    // workspacesListView, read by the grid, list and filter children.
    empty: { subtitle: 'Create your first workspace to get started' },
    noResults: { title: 'No workspaces found', subtitle: 'Try adjusting your search query' },
    sort: {
      button: { value: 'Sort options' },
      favorites: 'Favorites First',
      alphabetical: 'Alphabetical',
      recent: 'Recently Created',
    },
    view: { grid: { value: 'Grid view' }, list: { value: 'List view' } },
    list: {
      you: 'You',
      currentMember: 'Current member',
      default: 'Default',
      workspaceFallback: { value: 'Workspace' },
    },
    columns: {
      name: 'Workspace name',
      owner: 'Owner',
      type: 'Workspace type',
      actions: 'Actions',
    },
    roles: {
      owner: { value: 'Owner' },
      admin: { value: 'Admin' },
      member: { value: 'Member' },
      viewer: { value: 'Viewer' },
    },
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => workspaceState,
}));

vi.mock('./WorkspaceCard', () => ({
  WorkspaceCard: () => <div>workspace-card</div>,
}));

describe('WorkspacesListContent', () => {
  it('routes create workspace actions to onboarding create-workspace mode', async () => {
    const { default: WorkspacesListContent } = await import('./WorkspacesListContent');
    const container = document.createElement('div');
    const root = createRoot(container);

    pushMock.mockReset();

    await act(async () => {
      root.render(<WorkspacesListContent />);
    });

    const createWorkspaceButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Create Workspace'),
    ) as HTMLButtonElement | undefined;

    expect(createWorkspaceButton).toBeTruthy();

    await act(async () => {
      createWorkspaceButton?.click();
    });

    expect(pushMock).toHaveBeenCalledWith('/onboarding?mode=create-workspace');
  });

  it('renders the shared spinner while loading', async () => {
    workspaceState.loading = true;

    try {
      const { default: WorkspacesListContent } = await import('./WorkspacesListContent');
      const html = renderToStaticMarkup(<WorkspacesListContent />);

      expect(html).toContain('role="progressbar"');
      expect(html).toContain('Loading...');
    } finally {
      workspaceState.loading = false;
    }
  });

  it('does not render embedded workspace switch header', async () => {
    const { default: WorkspacesListContent } = await import('./WorkspacesListContent');
    const html = renderToStaticMarkup(<WorkspacesListContent embedded onCloseEmbedded={vi.fn()} />);

    expect(html).not.toContain('Switch workspace without leaving this page');
    expect(html).not.toContain('All Workspaces');
    expect(html).not.toContain('Close');
  });

  it('renders statements-style search bar in embedded mode', async () => {
    const { default: WorkspacesListContent } = await import('./WorkspacesListContent');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<WorkspacesListContent embedded onCloseEmbedded={vi.fn()} />);
    });

    const searchInput = container.querySelector('input[aria-label="Search workspaces..."]');
    expect(searchInput).toBeTruthy();
    // Compact and outlined: sized to what it holds, no filled background.
    expect(searchInput?.getAttribute('style')).toContain('padding: 8px 12px 8px 36px');
    expect(searchInput?.getAttribute('style')).toContain('background: transparent');
    expect(searchInput?.getAttribute('style')).toContain('border-radius: 8px');
  });

  it('switches to list format when list view button is clicked', async () => {
    const { default: WorkspacesListContent } = await import('./WorkspacesListContent');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<WorkspacesListContent />);
    });

    expect(container.textContent).toContain('workspace-card');

    const listViewButton = container.querySelector(
      'button[title="List view"]',
    ) as HTMLButtonElement;
    expect(listViewButton).toBeTruthy();

    await act(async () => {
      listViewButton.click();
    });

    expect(container.textContent).toContain('Workspace name');
    expect(container.textContent).not.toContain('workspace-card');
    expect(container.textContent).toContain('Main Workspace');
  });

  it('renders the create workspace tile as an outlined action, not a filled card', async () => {
    const { default: WorkspacesListContent } = await import('./WorkspacesListContent');
    const html = renderToStaticMarkup(<WorkspacesListContent />);

    expect(html).toContain('Create Workspace');
    // The old tile was a filled card; the dashed outline lives in the sx class now.
    const createTile = html.slice(
      html.lastIndexOf('<button', html.indexOf('Create Workspace')),
      html.indexOf('Create Workspace'),
    );
    expect(createTile).not.toContain('background:var(--card-bg)');
  });

  it('draws the create tile without a fixed aspect ratio, so it stretches to the row', async () => {
    const { default: WorkspacesListContent } = await import('./WorkspacesListContent');
    const html = renderToStaticMarkup(<WorkspacesListContent />);

    expect(html).not.toContain('aspect-ratio:16/9');
  });
});
