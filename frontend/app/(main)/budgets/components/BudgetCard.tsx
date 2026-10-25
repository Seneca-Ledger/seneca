'use client';

import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { budgetTone } from '@/app/(main)/dashboard/components/BudgetSummaryWidget';
import { Pencil, Trash2 } from '@/app/components/icons';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { localizeStatementCategoryName } from '@/app/lib/statement-categories';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { tokens } from '@/lib/theme-tokens';
import type { BudgetItem } from '../hooks/useBudgetsPage';
import type { StoicClass } from '../hooks/useStoicBalance';
import { StoicClassChip } from './StoicBalance';

const PERIOD_LABEL_KEYS = {
  weekly: 'periodWeekly',
  monthly: 'periodMonthly',
  quarterly: 'periodQuarterly',
  annual: 'periodAnnual',
} as const;

/**
 * As on the dashboard's budgets widget: sage while there is room, ochre close
 * to the limit, terracotta only past it — on a neutral track, so an empty
 * budget is a quiet grey line, not a band of mint.
 */
const TONE_FILL: Record<ReturnType<typeof budgetTone>, string> = {
  calm: 'var(--primary)',
  near: 'var(--attention)',
  over: 'var(--money-down)',
};

interface BudgetCardProps {
  budget: BudgetItem;
  /** How the budget's category is judged; null while nobody has decided. */
  stoicClass?: StoicClass | null;
  onEdit: (budget: BudgetItem) => void;
  onDelete: (id: string) => void;
}

export function BudgetCard({ budget, stoicClass = null, onEdit, onDelete }: BudgetCardProps) {
  const t = useIntlayer('budgetsPage');
  const { locale } = useLocale();
  const formatAmount = (amount: number, currency: string) =>
    formatMoney(amount, currency, locale, { fractionDigits: 0 });
  const tone = budgetTone(budget.percentUsed);
  const progressValue = Math.min(budget.percentUsed, 100);
  const availableAmount = budget.availableAmount ?? budget.limitAmount;
  const carriedAmount = budget.carriedAmount ?? 0;
  const formatDay = (date: string): string =>
    formatStoredDateWithOptions(`${date}T00:00:00`, { day: 'numeric', month: 'short' }, locale);

  return (
    <Box
      data-attention={`budget:${budget.categoryId}`}
      data-tour-shot={`budgets-${tone}`}
      sx={{
        p: 2.5,
        borderRadius: tokens.radius.lg,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        '&:hover': { borderColor: 'action.hover' },
      }}
    >
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}
      >
        <Box>
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 500,
            }}
          >
            {/* A budget named after a system category (the demo's are) reads in the user's language. */}
            {localizeStatementCategoryName(budget.name, locale)}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'text.secondary',
            }}
          >
            {budget.category
              ? localizeStatementCategoryName(budget.category.name, locale)
              : t.unknownCategory}{' '}
            · {t[PERIOD_LABEL_KEYS[budget.periodType]]}
            {/* A window cuts the period short, so the card has to say where it does. */}
            {budget.startsOn &&
              ` · ${t.windowFrom.value.replace('{{date}}', formatDay(budget.startsOn))}`}
            {budget.endsOn &&
              ` · ${t.windowUntil.value.replace('{{date}}', formatDay(budget.endsOn))}`}
            {stoicClass && (
              <>
                {' · '}
                <StoicClassChip stoicClass={stoicClass} />
              </>
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => onEdit(budget)}>
            <Pencil size={16} />
          </IconButton>
          <IconButton size="small" onClick={() => onDelete(budget.id)}>
            <Trash2 size={16} />
          </IconButton>
        </Box>
      </Box>

      <Box
        role="progressbar"
        aria-valuenow={Math.round(budget.percentUsed)}
        aria-valuemin={0}
        aria-valuemax={100}
        sx={{
          height: 6,
          mb: 1,
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: 'var(--icon-badge-bg)',
        }}
      >
        <Box
          sx={{
            width: `${progressValue}%`,
            height: '100%',
            borderRadius: 3,
            bgcolor: TONE_FILL[tone],
            transition: 'width 300ms ease',
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
          }}
        >
          <PrivateAmount>{formatAmount(budget.spentAmount, budget.currency)}</PrivateAmount> /{' '}
          <PrivateAmount>{formatAmount(availableAmount, budget.currency)}</PrivateAmount>
        </Typography>
        {/* The share stays neutral; only an overspent budget says so in colour. */}
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            color: tone === 'over' ? 'var(--money-down)' : 'text.primary',
          }}
        >
          {Math.round(budget.percentUsed)}%
        </Typography>
      </Box>
      {carriedAmount !== 0 && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            mt: 0.5,
            color: carriedAmount > 0 ? 'text.secondary' : 'var(--money-down)',
          }}
        >
          {fillTemplateNodes((carriedAmount > 0 ? t.carriedIn : t.overspendCarriedIn).value, {
            amount: formatAmount(Math.abs(carriedAmount), budget.currency),
          })}
        </Typography>
      )}
      {/* Spending in a currency with no rate is left out of the figure, not counted one to one. */}
      {(budget.unconvertedSpending ?? []).map(entry => (
        <Typography
          key={entry.currency}
          variant="caption"
          sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
        >
          {fillTemplateNodes(t.unconvertedSpending.value.replace('{{currency}}', budget.currency), {
            amount: formatMoney(entry.amount, entry.currency, locale),
          })}
        </Typography>
      ))}
      {/* Subscriptions paid from this budget, still to come this period. */}
      {(budget.subscriptionReserve?.amount ?? 0) > 0 && budget.subscriptionReserve && (
        <Typography
          variant="caption"
          title={budget.subscriptionReserve.items.map(item => item.vendorName).join(', ')}
          sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
        >
          {fillTemplateNodes(t.subscriptionReserve.value, {
            amount: formatAmount(budget.subscriptionReserve.amount, budget.currency),
          })}
        </Typography>
      )}
      {/* Spending earlier in the period than the start: without this, 0 reads as broken. */}
      {(budget.beforeStartSpending ?? []).map(entry => (
        <Typography
          key={`before-${entry.currency}`}
          variant="caption"
          sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
        >
          {fillTemplateNodes(t.beforeStartSpending.value, {
            amount: formatMoney(entry.amount, entry.currency, locale),
          })}
        </Typography>
      ))}
    </Box>
  );
}
