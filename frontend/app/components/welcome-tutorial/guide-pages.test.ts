import { describe, expect, it } from 'vitest';
import type { User } from '@/app/contexts/AuthContext';
import { GUIDE_PAGE_VERSION, guidePageFor, isGuidePageDue } from './guide-pages';

const user: User = {
  id: 'user-1',
  email: 'mia@example.com',
  name: 'Mia Hoffmann',
  role: 'user',
  onboardingCompletedAt: '2026-09-25T10:00:00.000Z',
  welcomeTutorialSeenAt: '2026-09-25T12:00:00.000Z',
  pageHintsSeen: {},
};

describe('guide pages', () => {
  it('finds the guide page of a sidebar page and of the pages under it', () => {
    expect(guidePageFor('/dashboard')).toBe('dashboard');
    expect(guidePageFor('/statements/submit')).toBe('statements');
    expect(guidePageFor('/net-worth')).toBe('netWorth');
    expect(guidePageFor('/settings/profile')).toBeNull();
  });

  it('is due until closed at the current version', () => {
    expect(isGuidePageDue(user, 'budgets')).toBe(true);
    expect(isGuidePageDue({ ...user, pageHintsSeen: { budgets: GUIDE_PAGE_VERSION - 1 } }, 'budgets')).toBe(true);
    expect(isGuidePageDue({ ...user, pageHintsSeen: { budgets: GUIDE_PAGE_VERSION } }, 'budgets')).toBe(false);
  });

  it('waits for onboarding, the welcome window and the server record', () => {
    expect(isGuidePageDue(null, 'budgets')).toBe(false);
    expect(isGuidePageDue({ ...user, onboardingCompletedAt: null }, 'budgets')).toBe(false);
    expect(isGuidePageDue({ ...user, welcomeTutorialSeenAt: null }, 'budgets')).toBe(false);
    expect(isGuidePageDue({ ...user, pageHintsSeen: undefined }, 'budgets')).toBe(false);
  });
});
