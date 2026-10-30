// @vitest-environment jsdom
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient, renderWithQuery } from '@/app/test/query-wrapper';
import Sidebar from './Sidebar';

const apiGet = vi.hoisted(() => vi.fn());
const permissions = vi.hoisted(() => ({ allowed: true }));

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet } }));
const route = vi.hoisted(() => ({ pathname: '/dashboard' }));

vi.mock('next/navigation', () => ({ usePathname: () => route.pathname }));
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
      new Proxy(
        {},
        {
          get: (_target, key) =>
            key === 'nav' || key === 'navGroups' ? nav : label(String(key)),
        },
      ),
  };
});

describe('Sidebar Review dot', () => {
  beforeEach(() => {
    apiGet.mockReset();
    permissions.allowed = true;
  });

  it('shows a dot on Review when something waits there', async () => {
    apiGet.mockResolvedValue({
      data: { transaction: 1, receipt: 1, duplicate: 0, subscription: 0, total: 2 },
    });

    renderWithQuery(<Sidebar />);

    expect(await screen.findByTestId('review-waiting-dot')).toBeTruthy();
    expect(screen.getByTestId('review-waiting-dot').closest('a')?.getAttribute('href')).toBe(
      '/review',
    );
    expect(apiGet).toHaveBeenCalledWith('/review-inbox/counts', expect.anything());
  });

  it('shows no dot when Review is empty', async () => {
    apiGet.mockResolvedValue({
      data: { transaction: 0, receipt: 0, duplicate: 0, subscription: 0, total: 0 },
    });

    renderWithQuery(<Sidebar />);

    await waitFor(() => expect(apiGet).toHaveBeenCalled());
    expect(screen.queryByTestId('review-waiting-dot')).toBeNull();
  });

  it('does not ask for the counts when Review is not in the menu', () => {
    permissions.allowed = false;

    renderWithQuery(<Sidebar />);

    // The member list may load (it decides whose backlog counts); the counts may not.
    expect(apiGet).not.toHaveBeenCalledWith('/review-inbox/counts', expect.anything());
    expect(screen.queryByTestId('review-waiting-dot')).toBeNull();
  });
});

describe('Sidebar groups', () => {
  beforeEach(() => {
    route.pathname = '/dashboard';
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: {} });
    permissions.allowed = true;
  });

  it('folds related pages under a group and keeps standalone pages as rows', () => {
    renderWithQuery(<Sidebar />);

    const analytics = screen.getByRole('button', { name: 'analytics' });
    expect(analytics.getAttribute('aria-expanded')).toBe('false');
    // A folded group stays mounted so it can animate; its wrapper says it is shut.
    const folded = screen.getByRole('link', { name: 'forecast', hidden: true });
    expect(folded.closest('[data-open]')?.getAttribute('data-open')).toBe('false');
    expect(screen.getByRole('link', { name: 'budgets' })).toBeTruthy();

    fireEvent.click(analytics);

    expect(analytics.getAttribute('aria-expanded')).toBe('true');
    expect(folded.closest('[data-open]')?.getAttribute('data-open')).toBe('true');
    expect(screen.getByRole('link', { name: 'forecast' }).getAttribute('href')).toBe('/forecast');
  });

  it('opens the group of the page on arrival and leaves it open on a page outside it', () => {
    route.pathname = '/forecast';
    const client = createTestQueryClient();
    const { rerender } = renderWithQuery(<Sidebar />, { client });
    const analytics = screen.getByRole('button', { name: 'analytics' });
    expect(analytics.getAttribute('aria-expanded')).toBe('true');

    route.pathname = '/workspaces';
    // The same tree renderWithQuery builds, so the sidebar stays mounted and this is
    // a navigation, not a fresh render.
    rerender(
      <QueryClientProvider client={client}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Sidebar />
        </LocalizationProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByRole('button', { name: 'analytics' })).toBe(analytics);
    expect(analytics.getAttribute('aria-expanded')).toBe('true');
  });

  it('keeps several groups open at once', () => {
    renderWithQuery(<Sidebar />);

    const analytics = screen.getByRole('button', { name: 'analytics' });
    const investments = screen.getByRole('button', { name: 'investments' });
    fireEvent.click(analytics);
    fireEvent.click(investments);

    expect(analytics.getAttribute('aria-expanded')).toBe('true');
    expect(investments.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('link', { name: 'reports' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'crypto' })).toBeTruthy();
  });

  it('does not shrink the rows when a group opens', () => {
    const { container } = renderWithQuery(<Sidebar />);
    const nav = container.querySelector('nav') as HTMLElement;
    const rows = nav.style.getPropertyValue('--seneca-sidebar-rows');

    fireEvent.click(screen.getByRole('button', { name: 'business' }));

    expect(nav.style.getPropertyValue('--seneca-sidebar-rows')).toBe(rows);
  });
});

describe('Sidebar pin button', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: {} });
    document.cookie = 'seneca-sidebar-collapsed=0; path=/';
  });

  it('switches the sidebar between the rail and the full width and remembers it', () => {
    const { container } = renderWithQuery(<Sidebar />);
    const aside = container.querySelector('aside') as HTMLElement;
    const pin = container.querySelector('.seneca-shell__sidebar-pin') as HTMLElement;

    // Outside the sidebar, so the sidebar's clipping cannot hide it.
    expect(aside.contains(pin)).toBe(false);
    expect(aside.className).not.toContain('seneca-shell__sidebar--rail');

    fireEvent.click(pin);
    expect(aside.className).toContain('seneca-shell__sidebar--rail');
    expect(document.cookie).toContain('seneca-sidebar-collapsed=1');

    fireEvent.click(pin);
    expect(aside.className).not.toContain('seneca-shell__sidebar--rail');
    expect(document.cookie).toContain('seneca-sidebar-collapsed=0');
  });
});
