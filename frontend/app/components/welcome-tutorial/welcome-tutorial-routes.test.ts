import { describe, expect, it } from 'vitest';
import type { User } from '@/app/contexts/AuthContext';
import { isNewAccount, isTutorialRoute, isWelcomeTutorialEligible } from './welcome-tutorial-routes';

const account: User = { id: 'user-1', email: 'mia@example.com', name: 'Mia', role: 'user' };
const newAccount: User = {
  ...account,
  onboardingCompletedAt: '2026-09-25T10:00:00.000Z',
  welcomeTutorialSeenAt: null,
};

describe('isNewAccount', () => {
  it('is true once onboarding is done and the tutorial was never closed', () => {
    expect(isNewAccount(newAccount)).toBe(true);
  });

  it('waits until onboarding is finished', () => {
    expect(isNewAccount({ ...newAccount, onboardingCompletedAt: null })).toBe(false);
  });

  it('is false once the tutorial was closed', () => {
    expect(isNewAccount({ ...newAccount, welcomeTutorialSeenAt: '2026-09-25T11:00:00.000Z' })).toBe(
      false,
    );
  });

  // Several endpoints return a user without the field; that must never read as "not seen".
  it('does not count a user object without the field', () => {
    const { welcomeTutorialSeenAt: _omitted, ...withoutField } = newAccount;
    expect(isNewAccount(withoutField)).toBe(false);
  });

  it('is false without a user', () => {
    expect(isNewAccount(null)).toBe(false);
  });
});

describe('isTutorialRoute', () => {
  it.each(['/dashboard', '/statements/submit', '/custom-tables/abc', '/workspaces/overview', '/crypto'])(
    'accepts the sidebar page %s',
    pathname => {
      expect(isTutorialRoute(pathname)).toBe(true);
    },
  );

  it.each(['/onboarding', '/invite/token', '/settings/workspace', '/login', '/shared/abc', '/'])(
    'rejects %s',
    pathname => {
      expect(isTutorialRoute(pathname)).toBe(false);
    },
  );

  it('does not match a page that only shares a prefix', () => {
    expect(isTutorialRoute('/dashboards')).toBe(false);
  });
});

describe('isWelcomeTutorialEligible', () => {
  it('opens for a new account on a sidebar page', () => {
    expect(
      isWelcomeTutorialEligible({ user: newAccount, loading: false, pathname: '/dashboard' }),
    ).toBe(true);
  });

  it('waits for the profile to load', () => {
    expect(isWelcomeTutorialEligible({ user: newAccount, loading: true, pathname: '/dashboard' })).toBe(
      false,
    );
  });

  it('stays closed off the sidebar pages', () => {
    expect(
      isWelcomeTutorialEligible({ user: newAccount, loading: false, pathname: '/onboarding' }),
    ).toBe(false);
    expect(isWelcomeTutorialEligible({ user: newAccount, loading: false, pathname: null })).toBe(false);
  });
});
