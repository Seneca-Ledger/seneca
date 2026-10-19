'use client';

import { useCallback } from 'react';
import { useIntlayer } from '@/app/i18n';
import { getNestedOnboardingValue, resolveOnboardingText } from './resolveOnboardingText';

export type OnboardingText = (path: string[], fallback?: string) => string;

/**
 * The onboarding dictionary in the language picked on the first step, which the
 * app may not have switched to yet when this renders.
 */
export function useOnboardingText(locale: string): OnboardingText {
  const t = useIntlayer('onboardingPage');
  return useCallback(
    (path: string[], fallback = '') =>
      resolveOnboardingText(getNestedOnboardingValue(t, path), fallback, locale),
    [t, locale],
  );
}
