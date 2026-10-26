'use client';

import Link from 'next/link';
import type React from 'react';
import { fillTemplate } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { Check, ChevronRight } from '@/app/components/icons';
import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { useIntlayer } from '@/app/i18n';
import {
  type AttentionItem,
  buildMonthCloseModel,
  type CloseStep,
  type CloseStepId,
} from './month-close-model';
import { DashboardCard, ListRow } from './ui';
import { useMonthLabel } from './use-month-label';

type MonthCloseCardProps = {
  data: DashboardData;
  formatAmount: (value: number) => string;
  displayMonth: Date;
};

type Dictionary = ReturnType<typeof useIntlayer<'monthCloseCard'>>;

const STEP_LABEL: Record<CloseStepId, keyof Dictionary['checklist']> = {
  reviewed: 'reviewQueueClear',
  categorized: 'categoriesResolved',
  receipts: 'receiptsMatched',
};

const STEP_LEFT: Record<CloseStepId, 'leftToReview' | 'leftUncategorized' | 'leftReceipts'> = {
  reviewed: 'leftToReview',
  categorized: 'leftUncategorized',
  receipts: 'leftReceipts',
};

const STEP_ACTION: Record<CloseStepId, 'actionReview' | 'actionCategorize' | 'actionMatch'> = {
  reviewed: 'actionReview',
  categorized: 'actionCategorize',
  receipts: 'actionMatch',
};

/** A sentence starts with a capital, whatever case the month name has in the locale. */
const capitalize = (text: string): string => text.charAt(0).toLocaleUpperCase() + text.slice(1);

const signed = (amount: number, formatAmount: (value: number) => string): string =>
  amount < 0 ? `−${formatAmount(Math.abs(amount))}` : formatAmount(amount);

function ActionLink({ href, children }: { href: string; children: string }): React.JSX.Element {
  return (
    <Link href={href} className="seneca-close-step__action">
      {children}
      <ChevronRight size={14} aria-hidden="true" />
    </Link>
  );
}

function StepRow({
  step,
  extra,
  t,
}: {
  step: CloseStep;
  /** Said after what is left, on the same line. */
  extra?: React.ReactNode;
  t: Dictionary;
}): React.JSX.Element {
  const left = fillTemplate(t[STEP_LEFT[step.id]].value, { count: String(step.count) });
  return (
    <ListRow
      className="seneca-close-step"
      leading={
        step.done ? (
          <Check size={16} className="seneca-close-step__done" aria-hidden="true" />
        ) : (
          <span className="seneca-close-step__open" aria-hidden="true" />
        )
      }
      primary={t.checklist[STEP_LABEL[step.id]].value}
      secondary={
        step.done ? undefined : (
          <>
            {left}
            {extra && <> · {extra}</>}
          </>
        )
      }
      trailing={
        step.done ? undefined : (
          <ActionLink href={step.href}>{t[STEP_ACTION[step.id]].value}</ActionLink>
        )
      }
    />
  );
}

function attentionText(item: AttentionItem, t: Dictionary): string {
  switch (item.id) {
    case 'unread':
      return fillTemplate(t.unread.value, { count: String(item.count) });
    case 'parsing':
      return fillTemplate(t.parsing.value, { count: String(item.count) });
  }
}

/**
 * What is left before the month in view closes: the steps, each with what is
 * left and where to do it, then statements worth a look only when there are any.
 */
export function MonthCloseCard({
  data,
  formatAmount,
  displayMonth,
}: MonthCloseCardProps): React.JSX.Element {
  const t = useIntlayer('monthCloseCard');
  const names = useIntlayer('overviewWidgets').sections;
  const month = capitalize(useMonthLabel(displayMonth));
  const model = buildMonthCloseModel(data, displayMonth);
  const total = model.steps.length;
  // Only the amount is redacted in privacy mode; the counts stay readable.
  const notCounted =
    model.notCounted === null
      ? undefined
      : fillTemplateNodes(t.notCounted.value, {
          amount: signed(model.notCounted, formatAmount),
        });

  return (
    <DashboardCard
      title={names.monthClose}
      subtitle={
        model.done === total
          ? fillTemplate(t.headlineDone.value, { month })
          : fillTemplate(t.headline.value, {
              month,
              done: String(model.done),
              total: String(total),
            })
      }
    >
      <div className="seneca-dashboard__list">
        {model.steps.map(step => (
          <StepRow
            key={step.id}
            step={step}
            extra={step.id === 'reviewed' ? notCounted : undefined}
            t={t}
          />
        ))}
        {model.attention.map(item => (
          <ListRow
            key={item.id}
            className="seneca-close-step"
            leading={<span className="seneca-close-step__open" aria-hidden="true" />}
            primary={attentionText(item, t)}
            trailing={<ActionLink href={item.href}>{t.attentionOpen.value}</ActionLink>}
          />
        ))}
      </div>
    </DashboardCard>
  );
}
