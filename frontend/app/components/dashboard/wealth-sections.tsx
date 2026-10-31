import type React from 'react';
import { BalancesCard } from './BalancesCard';
import { NetWorthCard } from './NetWorthCard';

/** The Overview's two views of what is owned and owed, keyed by section id. */
export function wealthSections(
  month: string,
  monthLabel: string,
): Record<'net-worth' | 'balances', React.ReactNode> {
  return {
    'net-worth': <NetWorthCard month={month} monthLabel={monthLabel} />,
    balances: <BalancesCard month={month} monthLabel={monthLabel} />,
  };
}
