import {
  formatDateTime as formatWithPreferences,
  type UserFormatPreferences,
} from '@/app/lib/user-format';

/**
 * Kept for existing call sites that only have a locale. New code should pass the
 * user's full format preferences so the chosen date order is respected.
 */
export const formatDateTime = (value?: string | null, locale?: string): string =>
  formatWithPreferences(value, { locale });

export const formatDateTimeFor = (
  value: string | null | undefined,
  preferences: UserFormatPreferences,
): string => formatWithPreferences(value, preferences);
