import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apiPost = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: apiPost,
  },
}));

vi.mock('@/app/i18n', () => ({
  useLocale: () => ({ locale: 'en' }),
  useIntlayer: () => ({
    subtitle: 'Join Lumio',
    // AuthHero reads its own `authHero` dictionary through the same mock.
    features: {},
    fullNameLabel: { value: 'Full name' },
    emailLabel: { value: 'Email localized' },
    passwordLabel: { value: 'Password' },
    passwordHelper: { value: 'At least 8 characters' },
    companyLabel: { value: 'Company (optional)' },
    submit: 'Sign up',
    haveAccount: 'Already have an account? Log in',
    rightTitle: 'Join Lumio',
    rightTagline: 'Automate your finances today',
    registerFailed: { value: 'Failed to sign up. Please try again.' },
    inviteLoadFailed: { value: 'Failed to load invitation.' },
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

describe('RegisterPage validation', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    apiPost.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('does not submit when password is shorter than 8 characters', async () => {
    const { default: RegisterPage } = await import('./page');

    await act(async () => {
      root.render(<RegisterPage />);
      await Promise.resolve();
    });

    const nameInput = container.querySelector('input[name="name"]') as HTMLInputElement | null;
    const emailInput = container.querySelector('input[name="email"]') as HTMLInputElement | null;
    const passwordInput = container.querySelector(
      'input[name="password"]',
    ) as HTMLInputElement | null;
    const submitButton = Array.from(container.querySelectorAll('button')).find(button =>
      button.textContent?.includes('Sign up'),
    ) as HTMLButtonElement | undefined;

    expect(nameInput).toBeTruthy();
    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();
    expect(container.textContent).toContain('Email localized');

    if (!(nameInput && emailInput && passwordInput && submitButton)) {
      throw new Error('Register form controls were not rendered');
    }

    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )?.set;

    if (!nativeInputValueSetter) {
      throw new Error('Failed to resolve native input value setter');
    }

    await act(async () => {
      nativeInputValueSetter.call(nameInput, 'Demo User');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeInputValueSetter.call(emailInput, 'demo@example.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeInputValueSetter.call(passwordInput, 'short');
      passwordInput.dispatchEvent(new Event('input', { bubbles: true }));
      submitButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(apiPost).not.toHaveBeenCalled();
    expect(container.textContent).toContain('At least 8 characters');
  });
});
