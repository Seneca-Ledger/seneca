// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPrivacyMode } from '@/app/lib/privacy-mode';
import { AccountMenu } from './AccountMenu';

const push = vi.hoisted(() => vi.fn());
const permissions = vi.hoisted(() => ({ granted: [] as string[] }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next-themes', () => ({ useTheme: () => ({ setTheme: vi.fn(), resolvedTheme: 'light' }) }));
vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Administrator', avatarUrl: null, themePreference: 'light' },
    logout: vi.fn(),
    setUser: vi.fn(),
  }),
}));
vi.mock('@/app/hooks/usePermissions', () => ({
  usePermissions: () => ({ hasPermission: (permission: string) => permissions.granted.includes(permission) }),
}));
vi.mock('./hooks/useThemePreference', () => ({
  useThemePreference: () => ({ handleThemePreferenceChange: vi.fn() }),
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: (key: string) =>
    key === 'adminPage'
      ? { title: 'Admin panel' }
      : {
          userMenu: new Proxy({}, { get: (_target, name) => String(name) }),
          nav: new Proxy({}, { get: (_target, name) => String(name) }),
        },
}));

afterEach(() => {
  act(() => setPrivacyMode(false));
  permissions.granted = [];
  push.mockReset();
});

describe('AccountMenu', () => {
  it('switches privacy mode from the row under the theme, and stays open', () => {
    render(<AccountMenu variant="mobile" />);
    fireEvent.click(screen.getByRole('button', { name: /Administrator/ }));

    const row = screen.getByRole('menuitem', { name: /privacyMode/ });
    expect(row.querySelector('input[type="checkbox"]')).not.toBeChecked();

    fireEvent.click(row);

    expect(document.documentElement.dataset.privacy).toBe('on');
    expect(screen.getByRole('menuitem', { name: /privacyMode/ }).querySelector('input')).toBeChecked();
    // The row before it is the theme switch.
    const items = screen.getAllByRole('menuitem').map(item => item.textContent);
    expect(items.indexOf('privacyMode')).toBe(items.indexOf('darkMode') + 1);
  });

  it('opens the admin page for whoever may read the audit log, in place of what was new', () => {
    permissions.granted = ['audit_log.view'];
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Administrator/ }));

    const items = screen.getAllByRole('menuitem').map(item => item.textContent);
    expect(items).not.toContain('whatsNew');
    expect(items.indexOf('Admin panel')).toBe(items.indexOf('settings') - 1);

    fireEvent.click(screen.getByRole('menuitem', { name: 'Admin panel' }));
    expect(push).toHaveBeenCalledWith('/admin');
  });

  it('leaves the admin page out for anyone else', () => {
    render(<AccountMenu />);
    fireEvent.click(screen.getByRole('button', { name: /Administrator/ }));

    expect(screen.queryByRole('menuitem', { name: 'Admin panel' })).toBeNull();
  });
});
