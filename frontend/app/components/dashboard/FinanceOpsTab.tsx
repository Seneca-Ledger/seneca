'use client';

import Button from '@mui/material/Button';
import Link from 'next/link';
import type React from 'react';
import { fillTemplate } from '@/app/(main)/dashboard/helpers/dashboard-helpers';
import { Check, ChevronRight, FileUp } from '@/app/components/icons';
import type { DashboardData } from '@/app/hooks/useDashboard';
import { useIntlayer } from '@/app/i18n';
import {
  type AttentionItem,
  buildFinanceOpsModel,
  type CloseStep,
  type CloseStepId,
} from './finance-ops-model';
import { DashboardCard, ListRow } from './ui';
import { useMonthLabel } from './use-month-label';

type FinanceOpsTabProps = {
  data: DashboardData;
  formatAmount: (value: number) => string;
  displayMonth: Date;
};

type Dictionary = ReturnType<typeof useIntlayer<'financeOpsTab'>>;

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

function StepRow({ step, t }: { step: CloseStep; t: Dictionary }): React.JSX.Element {
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
      secondary={step.done ? undefined : left}
      trailing={
        step.done ? undefined : (
          <Link href={step.href} className="seneca-close-step__action">
            {t[STEP_ACTION[step.id]].value}
            <ChevronRight size={14} aria-hidden="true" />
          </Link>
        )
      }
    />
  );
}

function attentionText(
  item: AttentionItem,
  t: Dictionary,
  formatAmount: (value: number) => string,
): string {
  switch (item.id) {
    case 'overdue':
      return fillTemplate(t.overdue.value, {
        count: String(item.count),
        amount: formatAmount(item.amount),
      });
    case 'overspent':
      return fillTemplate(t.overspent.value, { amount: formatAmount(item.amount) });
    case 'unread':
      return fillTemplate(t.unread.value, { count: String(item.count) });
    case 'parsing':
      return fillTemplate(t.parsing.value, { count: String(item.count) });
  }
}

/**
 * Finance ops answers one question: what is left before the month closes. One
 * list of the steps, each with what is left and where to do it; anything else
 * worth a look only when there is something.
 */
export function FinanceOpsTab({
  data,
  formatAmount,
  displayMonth,
}: FinanceOpsTabProps): React.JSX.Element {
  const t = useIntlayer('financeOpsTab');
  const month = capitalize(useMonthLabel(displayMonth));
  const model = buildFinanceOpsModel(data, displayMonth);
  const total = model.steps.length;

  return (
    <div className="seneca-dashboard__tab">
      <header className="seneca-close-head">
        <h2 className="seneca-close-head__title">
          {model.done === total
            ? fillTemplate(t.headlineDone.value, { month })
            : fillTemplate(t.headline.value, {
                month,
                done: String(model.done),
                total: String(total),
              })}
        </h2>
        <Button
          component={Link}
          href="/statements?openExpenseDrawer=scan"
          variant="outlined"
          size="small"
          startIcon={<FileUp size={16} />}
        >
          {t.upload.value}
        </Button>
      </header>
      <DashboardCard title={t.remainingTitle}>
        <div className="seneca-dashboard__list">
          {model.steps.map(step => (
            <StepRow key={step.id} step={step} t={t} />
          ))}
        </div>
      </DashboardCard>
      {model.attention.length > 0 && (
        <DashboardCard title={t.attentionTitle}>
          <div className="seneca-dashboard__list">
            {model.attention.map(item => (
              <ListRow
                key={item.id}
                className="seneca-close-step"
                leading={<span className="seneca-close-step__open" aria-hidden="true" />}
                primary={attentionText(item, t, formatAmount)}
                trailing={
                  <Link href={item.href} className="seneca-close-step__action">
                    {t.attentionOpen.value}
                    <ChevronRight size={14} aria-hidden="true" />
                  </Link>
                }
              />
            ))}
          </div>
        </DashboardCard>
      )}
    </div>
  );
}
