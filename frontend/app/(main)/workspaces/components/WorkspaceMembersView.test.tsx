import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGet = vi.hoisted(() => vi.fn());
const apiPost = vi.hoisted(() => vi.fn());
const apiPatch = vi.hoisted(() => vi.fn());
const apiDelete = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  default: {
    get: apiGet,
    post: apiPost,
    patch: apiPatch,
    delete: apiDelete,
  },
}));

vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'owner-1' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

describe('WorkspaceMembersView', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    apiGet.mockReset();
    apiPost.mockReset();
    apiPatch.mockReset();
    apiDelete.mockReset();

    apiGet.mockResolvedValue({
      data: {
        workspace: { id: 'ws-1', name: 'Workspace', ownerId: 'owner-1' },
        members: [
          {
            id: 'owner-1',
            email: 'owner@example.com',
            name: 'Workspace Owner',
            role: 'owner',
            joinedAt: '2026-01-01T00:00:00.000Z',
          },
          {
            id: 'viewer-1',
            email: 'viewer@example.com',
            name: 'Viewer User',
            role: 'viewer',
            joinedAt: '2026-01-05T00:00:00.000Z',
          },
          {
            id: 'member-1',
            email: 'member@example.com',
            name: 'Plain Member',
            role: 'member',
            permissions: { canEditStatements: true, canEditCategories: false },
            joinedAt: '2026-01-06T00:00:00.000Z',
          },
        ],
        invitations: [],
      },
    });
  });

  it('renders member controls and pending invitation note', async () => {
    const { default: WorkspaceMembersView } = await import('./WorkspaceMembersView');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<WorkspaceMembersView />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(container.textContent).toContain('Sort: Name');
    expect(container.textContent).toContain('Role: All roles');
    expect(container.textContent).toContain('Invitations expire in 7 days.');
    expect(container.textContent).toContain('No active invitations.');
  });

  it('counts only the toggles a member actually carries', async () => {
    const { default: WorkspaceMembersView } = await import('./WorkspaceMembersView');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<WorkspaceMembersView />);
    });
    await act(async () => {
      await flushPromises();
    });

    // One of the five is true; the other four are absent or false, and a
    // missing toggle is a right the member does not have.
    expect(container.textContent).toContain('Access permissions · 1/5');
    // Viewers and owners have no toggles to show.
    expect(container.textContent).not.toContain('Access permissions · 0/5');
  });

  it('sends the whole toggle set when one is flipped', async () => {
    apiPatch.mockResolvedValue({ data: {} });
    const { default: WorkspaceMembersView } = await import('./WorkspaceMembersView');
    const container = document.createElement('div');
    const root = createRoot(container);

    await act(async () => {
      root.render(<WorkspaceMembersView />);
    });
    await act(async () => {
      await flushPromises();
    });

    const trigger = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Access permissions · 1/5'),
    );
    expect(trigger).toBeTruthy();

    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    const categoriesItem = Array.from(document.querySelectorAll('li')).find(item =>
      item.textContent?.includes('Categories'),
    );
    expect(categoriesItem).toBeTruthy();

    await act(async () => {
      categoriesItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(apiPatch).toHaveBeenCalledWith('/workspaces/ws-1/members/member-1/permissions', {
      permissions: {
        canEditStatements: true,
        canEditCustomTables: false,
        canEditCategories: true,
        canEditDataEntry: false,
        canShareFiles: false,
      },
    });
  });
});
