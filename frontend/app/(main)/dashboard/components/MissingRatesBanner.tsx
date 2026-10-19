'use client';

import Link from 'next/link';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';

/** Rows in a currency without a rate were counted at face value; say so, with the way to fix it. */
export function MissingRatesBanner({
  currencies,
}: {
  currencies: string[];
}): React.JSX.Element | null {
  const t = useIntlayer('dashboardHeader');
  if (currencies.length === 0) return null;
  return (
    <div className="seneca-dashboard__rates-banner" role="status">
      <span>{t.missingRates.value.replace('{{currencies}}', currencies.join(', '))}</span>{' '}
      <Link href="/settings/profile?tab=data&section=exchange-rates">{t.missingRatesAction}</Link>
    </div>
  );
}
