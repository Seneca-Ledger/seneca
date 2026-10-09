'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft } from '@/app/components/icons';
import { useIntlayer, useLocale } from '@/app/i18n';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import { formatMoney } from '@/app/lib/format-money';
import type { GoalItem, GoalItemPayload } from '@/app/lib/goals-api';
import { tokens } from '@/lib/theme-tokens';
import { MonthStrip } from '../../dashboard/components/MonthStrip';
import { formatMonthParam } from '../../dashboard/helpers/dashboard-url-state';
import { GoalBudgetList } from './components/GoalBudgetList';
import { GoalFlowSankey } from './components/GoalFlowSankey';
import { GoalItemDialog } from './components/GoalItemDialog';
import { GoalItemsCard } from './components/GoalItemsCard';
import { GoalPlanCard } from './components/GoalPlanCard';
import { GoalProgressHeader } from './components/GoalProgressHeader';
import { useGoalFlow } from './hooks/useGoalFlow';
import { useGoalItems } from './hooks/useGoalItems';
import { useGoalPlan } from './hooks/useGoalPlan';
import { useMonthParam } from './hooks/useMonthParam';

export default function GoalDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const goalId = params?.id ?? '';
  const t = useIntlayer('goalDetailPage');
  const goalsT = useIntlayer('goalsPage');
  const headerT = useIntlayer('dashboardHeader');
  const { locale } = useLocale();

  const { month, changeMonth } = useMonthParam();
  const { data, isPending, error } = useGoalFlow(goalId, formatMonthParam(month));
  const showSkeleton = isPending && !data;
  const plan = useGoalPlan(goalId);
  const items = useGoalItems(goalId);

  // `editing === undefined` means the dialog is closed; null means it is open
  // for a new line. One state instead of an open flag plus a selection, which
  // could otherwise disagree.
  const [editing, setEditing] = useState<GoalItem | null | undefined>(undefined);
  const closeDialog = useCallback(() => setEditing(undefined), []);

  const saveItem = useCallback(
    async (payload: GoalItemPayload) => {
      if (editing) {
        await items.updateItem(editing.id, payload);
      } else {
        await items.createItem(payload);
      }
      setEditing(undefined);
    },
    [editing, items.createItem, items.updateItem],
  );

  const currency = data?.currency ?? FALLBACK_CURRENCY;
  const money = useCallback(
    (value: number) => formatMoney(value, currency, locale),
    [currency, locale],
  );

  const chartLabels = useMemo(
    () => ({
      otherMerchants: t.otherMerchants.value,
      planned: t.planned.value,
      actual: t.actual.value,
      overspent: t.overspent.value,
      underspent: t.underspent.value,
    }),
    [t],
  );

  return (
    <Box
      component="main"
      sx={{ px: { xs: 2, md: 4 }, pt: 'var(--lumio-page-top, 24px)', pb: 3, width: '100%' }}
    >
      <Button
        component={Link}
        href="/goals"
        size="small"
        startIcon={<ArrowLeft size={16} />}
        sx={{ mb: 2 }}
      >
        {t.back}
      </Button>

      {error && !isPending && (
        <Typography color="error" sx={{ py: 6, textAlign: 'center' }}>
          {t.error}
        </Typography>
      )}

      {showSkeleton && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Skeleton variant="text" width={220} height={32} />
          <Skeleton variant="rounded" height={8} sx={{ borderRadius: tokens.radius.full }} />
          <Skeleton variant="rounded" height={440} />
          {/* План и позиции грузятся отдельными запросами и раньше всплывали
              из ниоткуда после того, как Sankey уже сел. */}
          <Skeleton variant="rounded" height={160} />
          <Skeleton variant="rounded" height={220} />
        </Box>
      )}

      {data && (
        <>
          <GoalProgressHeader
            goal={data.goal}
            labels={{
              reached: goalsT.reached.value,
              remaining: goalsT.remaining.value,
            }}
            formatAmount={money}
          />

          <GoalFlowSankey
            data={data}
            title={t.flowTitle}
            subtitle={`${t.planned.value} ${money(data.plannedTotal)} · ${t.actual.value} ${money(data.actualTotal)}`}
            action={
              <MonthStrip
                displayMonth={month}
                onChange={changeMonth}
                locale={locale}
                labels={{
                  group: headerT.monthStripLabel.value,
                  previousYear: headerT.previousYear.value,
                  nextYear: headerT.nextYear.value,
                }}
              />
            }
            emptyLabel={t.noBudgets.value}
            labels={chartLabels}
            formatAmount={money}
          />

          {/* Cash carries no category, so it can never appear on the tree. The
              total would otherwise read low with nothing to explain it. */}
          {data.excluded.cashAmount > 0 && (
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
              {t.cashNote.value.replace('{{amount}}', money(data.excluded.cashAmount))}
            </Typography>
          )}

          {data.budgets.length > 0 && (
            <GoalBudgetList
              budgets={data.budgets}
              title={t.budgetsTitle}
              nativePeriodLabel={t.nativePeriod}
              locale={locale}
              formatAmount={money}
            />
          )}
        </>
      )}

      {!showSkeleton && plan.data && (
        <GoalPlanCard plan={plan.data} locale={locale} formatAmount={money} />
      )}

      {!showSkeleton && items.data && (
        <>
          <GoalItemsCard
            data={items.data}
            locale={locale}
            onAdd={() => setEditing(null)}
            onEdit={setEditing}
            onRemove={items.removeItem}
          />
          <GoalItemDialog
            open={editing !== undefined}
            editing={editing ?? null}
            defaultCurrency={items.data.currency}
            saving={items.isSaving}
            onSave={saveItem}
            onClose={closeDialog}
          />
        </>
      )}
    </Box>
  );
}
