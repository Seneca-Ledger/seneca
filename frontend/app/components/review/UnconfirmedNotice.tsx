'use client';

import clsx from 'clsx';
import Link from 'next/link';
import type React from 'react';
import { ChevronRight } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { resolveLabel } from '@/app/lib/side-panel-utils';
import { useReviewInboxTotal } from './useReviewInboxTotal';

/**
 * Only confirmed rows count in Lumio's numbers. Where numbers are shown, say
 * how much is still waiting in Review, so a total is never silently partial.
 */
export function UnconfirmedNotice({
  style,
  className,
}: {
  style?: React.CSSProperties;
  className?: string;
}): React.JSX.Element | null {
  const t = useIntlayer('unconfirmedNotice');
  const total = useReviewInboxTotal();
  if (total <= 0) {
    return null;
  }
  const message =
    total === 1
      ? resolveLabel(t?.messageOne, "1 item isn't confirmed yet and isn't counted here.")
      : resolveLabel(
          t?.message,
          "{{count}} items aren't confirmed yet and aren't counted here.",
        ).replace('{{count}}', String(total));

  return (
    <div
      role="status"
      data-testid="unconfirmed-notice"
      className={clsx('lumio-unconfirmed', className)}
      style={style}
    >
      <span className="lumio-unconfirmed__dot" aria-hidden="true" />
      <span className="lumio-unconfirmed__text">{message}</span>
      <Link href="/review" className="lumio-unconfirmed__action">
        {resolveLabel(t?.action, 'Review')}
        <ChevronRight size={14} aria-hidden="true" />
      </Link>
    </div>
  );
}
