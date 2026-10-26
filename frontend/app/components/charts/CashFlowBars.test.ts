import { describe, expect, it } from 'vitest';
import type { DashboardCashFlowEntry } from '@/app/hooks/useDashboard';
import { compressedAxis } from './chart-format';
import { entryRows, expenseStack } from './CashFlowBars';

const entry = (
  name: string,
  kind: DashboardCashFlowEntry['kind'],
  amount: number,
  budgeted = 0,
) => ({
  date: '2026-07-01',
  name,
  kind,
  amount,
  budgeted,
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

  it('colours a spend a budget covered blue, like its part of the bar', () => {
    const payment = entry('ACME Pay', 'expense', 11, 11);

    expect(entryRows([payment], value => `$${value}`)).toEqual([
      { label: payment.name, value: '$11', tone: 'budgeted' },
    ]);
  });

  it('names a spend partly over its budget twice: the budgeted part, then the rest', () => {
    const groceries = entry('ACME Market', 'expense', 70, 40);

    expect(entryRows([groceries], value => `$${value}`)).toEqual([
      { label: groceries.name, value: '$40', tone: 'budgeted' },
      { label: groceries.name, value: '$30', tone: 'negative' },
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

describe('expenseStack', () => {
  const { toY } = compressedAxis(2000, 10);
  const point = (expense: number, budgeted: number) => ({
    date: '2026-10-09',
    income: 0,
    expense,
    budgeted,
  });

  it('stacks the budgeted part under the rest, up to the whole day on the scale', () => {
    const stack = expenseStack(point(70, 40), toY);

    expect(stack.budgeted).toBe(toY(40));
    expect(stack.budgeted + stack.rest).toBeCloseTo(toY(70));
  });

  it('draws a fully budgeted day all blue and an unbudgeted one all terracotta', () => {
    expect(expenseStack(point(60, 60), toY).rest).toBe(0);
    expect(expenseStack(point(60, 0), toY)).toEqual({ budgeted: 0, rest: toY(60) });
  });

  it('never lets the budgeted part stand taller than the day', () => {
    const stack = expenseStack(point(60, 80), toY);

    expect(stack).toEqual({ budgeted: toY(60), rest: 0 });
  });
});
