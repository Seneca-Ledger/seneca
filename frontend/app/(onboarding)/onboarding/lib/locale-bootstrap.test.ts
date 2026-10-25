import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE } from '@/app/lib/locale';
import { resolveOnboardingBootstrapLocale } from './locale-bootstrap';

describe('resolveOnboardingBootstrapLocale', () => {
  it('keeps the currently active app locale for create-workspace onboarding bootstrap', () => {
    expect(resolveOnboardingBootstrapLocale('kk')).toBe('kk');
    expect(resolveOnboardingBootstrapLocale('de')).toBe('de');
  });

  it('falls back to the default locale only when the app locale is unsupported', () => {
    // Arabic was dropped with right-to-left support.
    expect(resolveOnboardingBootstrapLocale('ar')).toBe(DEFAULT_LOCALE);
    expect(resolveOnboardingBootstrapLocale(undefined)).toBe(DEFAULT_LOCALE);
  });
});
