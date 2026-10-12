'use client';

import { useEffect, useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';

export interface BudgetImpact {
  budgets: Array<{
    id: string;
    name: string;
    currency: string;
    remainingAfter: number;
    exceeds: boolean;
  }>;
  account: {
    walletId: string;
    name: string;
    currency: string;
    balanceAfter: number;
    overdraws: boolean;
  } | null;
}

interface Props {
  categoryId: string;
  amount: string;
  currency: string;
  date: string;
}

const formatAmount = (value: number, currency: string): string =>
  `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${currency}`;

const fill = (template: string, values: Record<string, string>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

/**
 * What this expense would do to the budgets it counts against and to the
 * account it lands in. Advice under the category field, never a gate: the
 * person can still book it.
 */
export function BudgetImpactNotice({ categoryId, amount, currency, date }: Props) {
  const t = useIntlayer('statementsCreateExpenseDrawer');
  const [impact, setImpact] = useState<BudgetImpact | null>(null);
  const parsedAmount = Number(amount.replace(',', '.'));

  useEffect(() => {
    if (!(categoryId && Number.isFinite(parsedAmount)) || parsedAmount <= 0) {
      setImpact(null);
      return;
    }
    const controller = new AbortController();
    // Debounced: the amount is typed digit by digit.
    const timer = setTimeout(() => {
      apiQueryDecoded({
        url: '/budgets/impact',
        params: { categoryId, amount: parsedAmount, currency, date: date || undefined },
        signal: controller.signal,
        contract: 'BudgetImpact',
      })
        .then(setImpact)
        .catch(() => setImpact(null));
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [categoryId, parsedAmount, currency, date]);

  if (!impact) return null;
  const lines: Array<{ key: string; text: string; warn: boolean }> = impact.budgets.map(budget => ({
    key: budget.id,
    warn: budget.exceeds,
    text: fill((budget.exceeds ? t.budgetOver : t.budgetLeft).value, {
      budget: budget.name,
      amount: formatAmount(Math.abs(budget.remainingAfter), budget.currency),
    }),
  }));
  if (impact.account?.overdraws) {
    lines.push({
      key: impact.account.walletId,
      warn: true,
      text: fill(t.accountOverdraw.value, {
        account: impact.account.name,
        balance: formatAmount(impact.account.balanceAfter, impact.account.currency),
      }),
    });
  }
  if (lines.length === 0) return null;

  return (
    <ul className="lumio-expense-drawer__impact" aria-live="polite">
      {lines.map(line => (
        <li
          key={line.key}
          className={
            line.warn
              ? 'lumio-expense-drawer__impact-line lumio-expense-drawer__impact-line--warn'
              : 'lumio-expense-drawer__impact-line'
          }
        >
          {line.text}
        </li>
      ))}
    </ul>
  );
}
