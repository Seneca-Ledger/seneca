'use client';

import { useIntlayer } from '@/app/i18n';
import type { PaymentType } from '@/app/lib/contracts';

/** How the bank says the money moved, as quiet text under the description. */
export function PaymentTypeLabel({ type }: { type?: PaymentType | null }) {
  const t = useIntlayer('paymentTypes');
  if (!type) {
    return null;
  }
  return (
    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
      {t[type]}
    </span>
  );
}
