import { describe, expect, it } from 'vitest';
import type { DashboardCashFlowEntry } from '@/app/hooks/useDashboard';
import { entryRows } from './CashFlowBars';

const entry = (name: string, kind: DashboardCashFlowEntry['kind'], amount: number) => ({
  date: '2026-07-01',
  name,
  kind,
  amount,
});

describe('entryRows', () => {
  it('names each row of the day, toned by side, instead of income/expense totals', () => {
    const salary = entry('Member One', 'income', 900);
    const coffee = entry('ACME Coffee', 'expense', 4.5);

    expect(entryRows([salary, coffee], value => `$${value}`)).toEqual([
      { label: salary.name, value: '$900', tone: 'positive' },
      { label: coffee.name, value: '$4.5', tone: 'negative' },
    ]);
  });

  it('names the five biggest and marks the rest with an ellipsis', () => {
    const day = Array.from({ length: 7 }, (_, index) => entry(`Shop ${index}`, 'expense', 10));

    const rows = entryRows(day, String);

    expect(rows).toHaveLength(6);
    expect(rows.at(-1)).toEqual({ value: '…' });
  });

  it('shows an ellipsis while the rows are loading', () => {
    expect(entryRows(undefined, String)).toEqual([{ value: '…' }]);
  });
});
