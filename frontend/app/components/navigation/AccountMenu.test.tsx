// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setPrivacyMode } from '@/app/lib/privacy-mode';
import { AccountMenu } from './AccountMenu';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next-themes', () => ({ useTheme: () => ({ setTheme: vi.fn(), resolvedTheme: 'light' }) }));
vi.mock('@/app/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', name: 'Administrator', avatarUrl: null, themePreference: 'light' },
    logout: vi.fn(),
    setUser: vi.fn(),
  }),
}));
vi.mock('@/app/hooks/usePermissions', () => ({ usePermissions: () => ({ hasPermission: () => false }) }));
vi.mock('./hooks/useThemePreference', () => ({
  useThemePreference: () => ({ handleThemePreferenceChange: vi.fn() }),
}));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () => ({
    userMenu: new Proxy({}, { get: (_target, key) => String(key) }),
    nav: new Proxy({}, { get: (_target, key) => String(key) }),
  }),
}));

afterEach(() => {
  act(() => setPrivacyMode(false));
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
});
