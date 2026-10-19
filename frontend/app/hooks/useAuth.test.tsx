// @vitest-environment jsdom

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { currentUser } from '@/app/test/fixtures/contracts';
import { AuthProvider } from '../contexts/AuthContext';

// Hoisted: the static AuthProvider import evaluates the api mock factory before
// module-level consts would be initialised.
const { push, get } = vi.hoisted(() => ({ push: vi.fn(), get: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/dashboard',
}));

vi.mock('@/app/lib/api', () => ({
  __esModule: true,
  default: {
    get,
  },
}));

describe('useAuth', () => {
  beforeEach(() => {
    push.mockReset();
    get.mockReset();
    localStorage.clear();
    document.cookie = 'INTLAYER_LOCALE=; Max-Age=0; path=/';
    document.cookie = 'intlayer-locale=; Max-Age=0; path=/';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '/dashboard' },
    });
  });

  it('syncs the saved user locale into the i18n cookie after auth bootstrap', async () => {
    document.cookie = 'csrf_token=csrf-token';
    get.mockResolvedValue({
      data: currentUser({
        role: 'admin',
        locale: 'en',
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    const { useAuth } = await import('./useAuth');

    renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(document.cookie).toContain('INTLAYER_LOCALE=en');
    });
  });

  it('does not overwrite an explicitly selected locale during auth bootstrap', async () => {
    document.cookie = 'csrf_token=csrf-token';
    document.cookie = 'INTLAYER_LOCALE=kk; path=/';

    get.mockResolvedValue({
      data: currentUser({
        role: 'admin',
        locale: 'ru',
        onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
      }),
    });

    const { useAuth } = await import('./useAuth');

    renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith('/auth/me');
    });

    expect(document.cookie).toContain('INTLAYER_LOCALE=kk');
  });
});
