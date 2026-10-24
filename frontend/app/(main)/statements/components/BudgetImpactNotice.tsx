'use client';

import type React from 'react';
import { useEffect, useState } from 'react';
import { fillTemplateNodes } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';

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
  /** The account picked for the expense; without one the notice says nothing about an account. */
  walletId?: string;
}

const formatAmount = (value: number, currency: string): string =>
  `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)} ${currency}`;

/** Names go in as words; the money (`amount`/`balance`) stays redactable. */
const fill = (template: string, name: [string, string], money: Record<string, string>) =>
  fillTemplateNodes(template.replaceAll(`{{${name[0]}}}`, name[1]), money);

/**
 * What this expense would do to the budgets it counts against and to the
 * account it lands in. Advice under the category field, never a gate: the
 * person can still book it.
 */
export function BudgetImpactNotice({ categoryId, amount, currency, date, walletId }: Props) {
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
        params: {
          categoryId,
          amount: parsedAmount,
          currency,
          date: date || undefined,
          walletId,
        } satisfies ContractInput<'BudgetImpactQuery'>,
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
  }, [categoryId, parsedAmount, currency, date, walletId]);

  if (!impact) return null;
  const lines: Array<{ key: string; text: React.ReactNode; warn: boolean }> = impact.budgets.map(
    budget => ({
      key: budget.id,
      warn: budget.exceeds,
      text: fill((budget.exceeds ? t.budgetOver : t.budgetLeft).value, ['budget', budget.name], {
        amount: formatAmount(Math.abs(budget.remainingAfter), budget.currency),
      }),
    }),
  );
  if (impact.account?.overdraws) {
    lines.push({
      key: impact.account.walletId,
      warn: true,
      text: fill(t.accountOverdraw.value, ['account', impact.account.name], {
        balance: formatAmount(impact.account.balanceAfter, impact.account.currency),
      }),
    });
  }
  if (lines.length === 0) return null;

  return (
    <ul className="seneca-expense-drawer__impact" aria-live="polite">
      {lines.map(line => (
        <li
          key={line.key}
          className={
            line.warn
              ? 'seneca-expense-drawer__impact-line seneca-expense-drawer__impact-line--warn'
              : 'seneca-expense-drawer__impact-line'
          }
        >
          {line.text}
        </li>
      ))}
    </ul>
  );
}
