'use client';

import Link from 'next/link';
import type React from 'react';
import { Alert } from '@/app/components/ui/alert';
import { useIntlayer } from '@/app/i18n';
import { resolveLabel } from '@/app/lib/side-panel-utils';
import { useReviewInboxTotal } from './useReviewInboxTotal';

/**
 * Only confirmed rows count in Lumio's numbers. Where numbers are shown, say
 * how much is still waiting in Review, so a total is never silently partial.
 */
export function UnconfirmedNotice({
  style,
}: {
  style?: React.CSSProperties;
}): React.JSX.Element | null {
  const t = useIntlayer('unconfirmedNotice');
  const total = useReviewInboxTotal();
  if (total <= 0) {
    return null;
  }
  const message = resolveLabel(
    t?.message,
    "{{count}} items aren't confirmed yet and aren't counted here.",
  ).replace('{{count}}', String(total));

  return (
    <Alert role="status" data-testid="unconfirmed-notice" style={style}>
      {message} <Link href="/review">{resolveLabel(t?.action, 'Review')}</Link>
    </Alert>
  );
}
