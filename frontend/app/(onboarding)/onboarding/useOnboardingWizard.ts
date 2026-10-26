'use client';

import { useCallback, useState } from 'react';
import type { WorkspaceProfile } from '@/app/components/navigation/helpers/navigation-config';
import type { AppLocale as SupportedLocale } from '@/app/lib/locale';
import type { DateFormatPreference } from '@/app/lib/user-format';

export type { AppLocale as SupportedLocale } from '@/app/lib/locale';

export type TaxpayerType = 'self_employed' | 'employee' | 'company';

export interface OnboardingBusinessDetails {
  legalName: string;
  taxId: string;
  registrationId: string;
  addressLines: string;
}

export const EMPTY_BUSINESS_DETAILS: OnboardingBusinessDetails = {
  legalName: '',
  taxId: '',
  registrationId: '',
  addressLines: '',
};

export interface OnboardingData {
  locale: SupportedLocale;
  timeZone: string | null;
  dateFormat: DateFormatPreference;
  firstDayOfWeek: number | null;
  workspaceName: string;
  workspaceCurrency: string;
  /** Not asked: the workspace's own, or one picked at random so a new card is never blank. */
  workspaceBackgroundImage: string | null;
  /** Null until answered: the question has no default. */
  profile: WorkspaceProfile | null;
  /** ISO 3166-1 alpha-2; null for "not listed / decide later". */
  taxCountry: string | null;
  taxpayerType: TaxpayerType | null;
  business: OnboardingBusinessDetails;
}

/**
 * The answers and the step index. Which steps exist depends on the answers (the
 * business step follows the profile), so the page owns the step list and the
 * bounds; this only holds state.
 */
export function useOnboardingWizard(initialData: OnboardingData) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<OnboardingData>(initialData);

  const updateData = useCallback((patch: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...patch }));
  }, []);

  return { currentStep, setCurrentStep, data, updateData };
}
