// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import Sidebar from './Sidebar';

const apiGet = vi.hoisted(() => vi.fn());
const permissions = vi.hoisted(() => ({ allowed: true }));

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet } }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/hooks/useAuth', () => ({ useAuth: () => ({ loading: false }) }));
vi.mock('@/app/contexts/WorkspaceContext', () => ({
  useWorkspace: () => ({ loading: false, currentWorkspace: { settings: {} } }),
}));
vi.mock('@/app/hooks/useNotifications', () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: () => permissions.allowed }),
}));
vi.mock('@/app/lib/experimental-mode', () => ({ useExperimentalMode: () => false }));
vi.mock('./navigation/AccountMenu', () => ({ AccountMenu: () => null }));
// Menu labels render as nodes (plain strings here); every other label is read as `{ value }`.
vi.mock('@/app/i18n', () => {
  const label = (name: string): unknown =>
    new Proxy(
      { value: name },
      { get: (target, key) => (key === 'value' ? target.value : label(String(key))) },
    );
  const nav = new Proxy({}, { get: (_target, key) => String(key) });
  return {
    useIntlayer: () =>
      new Proxy({}, { get: (_target, key) => (key === 'nav' ? nav : label(String(key))) }),
  };
});

describe('Sidebar Review dot', () => {
  beforeEach(() => {
    apiGet.mockReset();
    permissions.allowed = true;
  });

  it('shows a dot on Review when something waits there', async () => {
    apiGet.mockResolvedValue({ data: { total: 2 } });

    renderWithQuery(<Sidebar />);

    expect(await screen.findByTestId('review-waiting-dot')).toBeTruthy();
    expect(screen.getByTestId('review-waiting-dot').closest('a')?.getAttribute('href')).toBe(
      '/review',
    );
    expect(apiGet).toHaveBeenCalledWith('/review-inbox/counts', expect.anything());
  });

  it('shows no dot when Review is empty', async () => {
    apiGet.mockResolvedValue({ data: { total: 0 } });

    renderWithQuery(<Sidebar />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(screen.queryByTestId('review-waiting-dot')).toBeNull();
  });

  it('does not ask for the counts when Review is not in the menu', () => {
    permissions.allowed = false;

    renderWithQuery(<Sidebar />);

    expect(apiGet).not.toHaveBeenCalled();
    expect(screen.queryByTestId('review-waiting-dot')).toBeNull();
  });
});
