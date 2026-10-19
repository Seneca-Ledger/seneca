'use client';

import type React from 'react';
import { insightHref } from '@/app/components/insights/insight-href';
import { type Insight, useInsights } from '@/app/hooks/useInsights';
import { useIntlayer } from '@/app/i18n';
import { useTodayNote } from './overview-month';
import { CardLink, DashboardCard, ListRow } from './ui';

const VISIBLE_ITEMS = 3;

/** The advice page's order: the Stoic reading of the month, then the experts, then observations. */
const rank = (item: Insight): number =>
  item.type.startsWith('stoic.') ? 2 : item.type === 'expert.principle' ? 1 : 0;

/**
 * The top of the advice feed. Warnings already reach every page through the
 * alert banner, so this takes only the advice; it reads the cached feed and
 * leaves recomputing it to the advice page, which the reader opens on purpose.
 */
export function AdviceCard(): React.JSX.Element | null {
  const t = useIntlayer('overviewWidgets');
  const today = useTodayNote();
  const { items } = useInsights({ severities: ['info'] });

  if (items.length === 0) {
    return null;
  }

  const top = [...items].sort((a, b) => rank(b) - rank(a)).slice(0, VISIBLE_ITEMS);
  return (
    <DashboardCard
      title={t.sections.advice}
      subtitle={today}
      action={<CardLink href="/advice">{t.allAdvice}</CardLink>}
    >
      <div className="seneca-dashboard__list">
        {top.map(item => (
          <ListRow
            key={item.id}
            href={insightHref(item) ?? '/advice'}
            primary={item.title}
            secondary={item.message}
          />
        ))}
      </div>
    </DashboardCard>
  );
}
