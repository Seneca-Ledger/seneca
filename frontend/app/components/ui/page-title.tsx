'use client';

import Link from 'next/link';
import React from 'react';
import { MoveLeft } from '@/app/components/icons';
import { buildNavItems } from '@/app/components/navigation/helpers/navigation-config';
import { useIntlayer } from '@/app/i18n';
import { DEFAULT_APP_ROUTE } from '@/app/lib/default-app-route';

/**
 * A page's heading: the icon and name its sidebar row has, so the row and the
 * page it opens always match. Pages with filters pass `summary`, a line after
 * an arrow saying what the page shows right now. On the right, every page but
 * the dashboard says where it is: Home / the page.
 */
export function PageTitle({
  path,
  icon,
  summary,
}: {
  /** The sidebar path whose label and icon the heading takes. */
  path: string;
  /** Replaces the row's own icon, e.g. with its group's. */
  icon?: React.ReactElement<{ size?: number }>;
  summary?: string;
}): React.JSX.Element {
  const { nav, breadcrumbs } = useIntlayer('navigation');
  const item = buildNavItems((nav ?? {}) as Parameters<typeof buildNavItems>[0]).find(
    candidate => candidate.path === path,
  );
  const shownIcon = icon ?? (item?.icon as React.ReactElement<{ size?: number }> | undefined);

  return (
    <div className="seneca-page-title">
      <div className="seneca-page-title__text">
        <h1 className="seneca-page-title__heading">
          {shownIcon ? (
            <span className="seneca-page-title__icon" aria-hidden="true">
              {React.cloneElement(shownIcon, { size: 22 })}
            </span>
          ) : null}
          {item?.label}
        </h1>
        {summary ? (
          <>
            {' '}
            <MoveLeft size={18} className="seneca-page-title__arrow" aria-hidden="true" />{' '}
            <span className="seneca-page-title__summary" aria-live="polite">
              {summary}
            </span>
          </>
        ) : null}
      </div>
      {path === DEFAULT_APP_ROUTE ? null : (
        <nav className="seneca-page-title__crumbs" aria-label={breadcrumbs?.label?.value}>
          <Link href={DEFAULT_APP_ROUTE}>{breadcrumbs?.home}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{item?.label}</span>
        </nav>
      )}
    </div>
  );
}

/** A summary from the parts in force: empty ones are left out, the rest joined by a dot. */
export function joinSummary(parts: Array<string | null | undefined | false>): string | undefined {
  const kept = parts.filter(
    (part): part is string => typeof part === 'string' && part.trim() !== '',
  );
  return kept.length > 0 ? kept.join(' · ') : undefined;
}
