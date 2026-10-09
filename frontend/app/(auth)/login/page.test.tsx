import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPost = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  __esModule: true,
  default: {
    post: apiPost,
  },
}));

vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'en' }),
  useIntlayer: () => ({
    subtitle: 'Log in to continue using Lumio',
    // AuthHero reads its own `authHero` dictionary through the same mock.
    features: {},
    rightTagline: 'A platform for bank statement processing',
    emailLabel: { value: 'Email localized' },
    passwordLabel: { value: 'Password' },
    submit: 'Log in',
    noAccount: "Don't have an account? Sign up",
    loginFailed: { value: 'Failed to log in. Please try again.' },
  }),
}));

vi.mock('@/app/components/AuthLanguageSwitcher', () => ({
  AuthLanguageSwitcher: () => <div data-testid="auth-language-switcher" />,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: () => null,
  }),
}));

describe('LoginPage locale persistence', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let locationHref = '';
  const storage = new Map<string, string>();

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
      },
    });
    document.cookie = 'INTLAYER_LOCALE=; Max-Age=0; path=/';
    document.cookie = 'intlayer-locale=; Max-Age=0; path=/';
    document.cookie = 'INTLAYER_LOCALE=en; path=/';
    document.cookie = 'intlayer-locale=en; path=/';
    apiPost.mockReset();
    locationHref = '';

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        get href() {
          return locationHref;
        },
        set href(value: string) {
          locationHref = value;
        },
      },
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('keeps the explicitly selected English locale after a successful login', async () => {
    apiPost.mockResolvedValue({
      data: {
        user: {
          id: 'user-1',
          email: 'user@example.com',
          name: 'User',
          locale: 'ru',
          onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
          lastWorkspaceId: 'workspace-1',
        },
      },
    });

    const { default: LoginPage } = await import('./page');

    await act(async () => {
      root.render(<LoginPage />);
      await Promise.resolve();
    });

    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement | null;
    const passwordInput = container.querySelector(
      'input[name="password"]',
    ) as HTMLInputElement | null;
    const submitButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Log in'),
    ) as HTMLButtonElement | undefined;

    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();
    expect(container.textContent).toContain('Email localized');

    if (!(emailInput && passwordInput && submitButton)) {
      throw new Error('Login form controls were not rendered');
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    if (!nativeInputValueSetter) {
      throw new Error('Failed to resolve native input value setter');
    }

    await act(async () => {
      nativeInputValueSetter.call(emailInput, 'user@example.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeInputValueSetter.call(passwordInput, 'secret');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(apiPost).toHaveBeenCalledWith('/auth/login', {
      email: 'user@example.com',
      password: 'secret',
    });
    expect(document.cookie).toContain('INTLAYER_LOCALE=en');
    expect(locationHref).toBe('/dashboard');
  });

  it('redirects users with a workspace to the dashboard after login even without lastWorkspaceId', async () => {
    apiPost.mockResolvedValue({
      data: {
        user: {
          id: 'user-2',
          email: 'admin@example.com',
          name: 'Admin',
          locale: 'en',
          onboardingCompletedAt: '2026-01-01T00:00:00.000Z',
          workspaceId: 'workspace-primary',
          lastWorkspaceId: null,
        },
      },
    });

    const { default: LoginPage } = await import('./page');

    await act(async () => {
      root.render(<LoginPage />);
      await Promise.resolve();
    });

    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement | null;
    const passwordInput = container.querySelector(
      'input[name="password"]',
    ) as HTMLInputElement | null;
    const submitButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Log in'),
    ) as HTMLButtonElement | undefined;

    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();

    if (!(emailInput && passwordInput && submitButton)) {
      throw new Error('Login form controls were not rendered');
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    if (!nativeInputValueSetter) {
      throw new Error('Failed to resolve native input value setter');
    }

    await act(async () => {
      nativeInputValueSetter.call(emailInput, 'admin@example.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeInputValueSetter.call(passwordInput, 'secret');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(localStorage.getItem('currentWorkspaceId')).toBe('workspace-primary');
    expect(locationHref).toBe('/dashboard');
  });
});
