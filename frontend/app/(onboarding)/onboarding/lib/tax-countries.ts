'use client';

import { useQuery } from '@tanstack/react-query';
import {
  type Jurisdiction,
  type JurisdictionRate,
  todayLocal,
} from '@/app/(main)/workspaces/components/tax-jurisdiction.helpers';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { resolveLocaleTag } from '@/app/lib/user-format';

/** The catalogue changes with a backend release, not within a session. */
export function useJurisdictions() {
  return useQuery({
    queryKey: queryKeys.taxJurisdictions(),
    queryFn: ({ signal }) => apiQuery<Jurisdiction[]>({ url: '/tax/jurisdictions', signal }),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** The default rate, or the highest when none is marked default. */
function pickStandardRate(rates: JurisdictionRate[]): JurisdictionRate | null {
  return (
    rates.find(rate => rate.isDefault) ??
    [...rates].sort((a, b) => Number(b.rate) - Number(a.rate))[0] ??
    null
  );
}

/** The standard rate in force today: what the workspace will apply once the country is set. */
export function useStandardRate(code: string | null) {
  const on = todayLocal();
  return useQuery({
    queryKey: queryKeys.taxJurisdictionRates({ code, date: on }),
    queryFn: ({ signal }) =>
      apiQuery<JurisdictionRate[]>({
        url: `/tax/jurisdictions/${code}/rates`,
        params: { date: on },
        signal,
      }),
    enabled: Boolean(code),
    staleTime: Number.POSITIVE_INFINITY,
    select: pickStandardRate,
  });
}

/**
 * The country in the interface language. The catalogue's own names are English,
 * and a German user should not have to find "Germany" among "Deutschland"-less rows.
 */
export function countryName(code: string, locale: string, fallback: string = code): string {
  try {
    return (
      new Intl.DisplayNames([resolveLocaleTag(locale)], { type: 'region' }).of(code) ?? fallback
    );
  } catch {
    return fallback;
  }
}

/**
 * The country the browser's language points at, when the catalogue has it. Only
 * used to put it first in the list: 'en-US' is the default far outside the US, so
 * a tax setting is never pre-filled from it.
 */
export function suggestedCountry(
  codes: string[],
  languages: readonly string[] = typeof navigator === 'undefined' ? [] : navigator.languages,
): string | null {
  for (const language of languages) {
    const region = language.split('-')[1]?.toUpperCase();
    if (region && codes.includes(region)) {
      return region;
    }
  }
  return null;
}

export interface CountryOption {
  code: string;
  name: string;
}

/** Sorted by the localised name, the suggested country first. */
export function countryOptions(
  jurisdictions: Jurisdiction[],
  locale: string,
  suggested: string | null,
): CountryOption[] {
  const collator = new Intl.Collator(resolveLocaleTag(locale));
  const options = jurisdictions
    .map(jurisdiction => ({
      code: jurisdiction.code,
      name: countryName(jurisdiction.code, locale, jurisdiction.name),
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
  const first = options.findIndex(option => option.code === suggested);
  if (first > 0) {
    options.unshift(...options.splice(first, 1));
  }
  return options;
}
