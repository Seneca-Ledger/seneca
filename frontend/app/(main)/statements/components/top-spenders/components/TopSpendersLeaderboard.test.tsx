import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TopSpenderAggregateRow } from '../top-spenders.types';
import { TopSpendersLeaderboard } from './TopSpendersLeaderboard';

vi.mock('@/app/components/ui/EmptyStateIllustration', () => ({ EmptyStateIllustration: () => null }));
vi.mock('@/app/lib/user-format-store', () => ({ formatStoredDate: (value: string) => value }));

const row: TopSpenderAggregateRow = {
  id: 'r1',
  company: 'Rewe',
  sourceType: 'gmail',
  sourceChannel: 'receipt',
  flowType: 'spend',
  count: 4,
  total: 100,
  average: 25,
  lastDate: '2026-09-01',
  currency: 'EUR',
} as TopSpenderAggregateRow;

const renderWith = (sortKey: 'amount' | 'average' | 'operations') =>
  render(
    <TopSpendersLeaderboard
      rows={[row]}
      sortKey={sortKey}
      onSortChange={() => {}}
      onRowClick={() => {}}
      title="List"
      currency="EUR"
      sourceLabels={{ sourceBank: 'Bank', sourceReceipt: 'Receipt', sourceGmailInbox: 'Gmail', sourceCrypto: 'Crypto' }}
      sortLabels={{ sortByAmount: 'By amount', sortByAverage: 'By average', sortByOperations: 'By operations' }}
      columnLabels={{
        company: 'Company',
        source: 'Source',
        operations: 'Operations',
        average: 'Average',
        amount: 'Amount',
        lastOperation: 'Last',
      }}
      emptyLabel="Empty"
    />,
  );

describe('TopSpendersLeaderboard', () => {
  it('marks the sorted column, not always the amount', () => {
    renderWith('average');

    const average = screen.getByRole('columnheader', { name: /Average/ });
    expect(average.getAttribute('aria-sort')).toBe('descending');
    expect(screen.getByRole('columnheader', { name: /Amount/ }).getAttribute('aria-sort')).toBeNull();
    expect(screen.getByRole('button', { name: 'By average' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/25,00|25\.00/).style.fontWeight).toBe('600');
    expect(screen.getByText(/100,00|100\.00/).style.fontWeight).toBe('');
  });
});
