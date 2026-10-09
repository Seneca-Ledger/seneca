import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TopMerchantAggregateRow } from '@/app/(main)/statements/components/top-merchants/top-merchants.types';
import { TopMerchantsLeaderboard } from './TopMerchantsLeaderboard';

vi.mock('@/app/lib/user-format-store', () => ({
  formatStoredDate: (value: string) => value,
}));

function row(overrides: Partial<TopMerchantAggregateRow>): TopMerchantAggregateRow {
  return {
    id: 'spend:bank:EUR:café einstein',
    merchant: 'Café Einstein',
    sourceType: 'statement',
    sourceChannel: 'bank',
    flowType: 'spend',
    count: 9,
    total: 120,
    average: 13.33,
    lastDate: '2026-09-13',
    currency: 'EUR',
    ...overrides,
  };
}

function renderLeaderboard(rows: TopMerchantAggregateRow[], focusId?: string | null) {
  return render(
    <TopMerchantsLeaderboard
      rows={rows}
      sortKey="amount"
      onSortChange={vi.fn()}
      onRowClick={vi.fn()}
      title="Top merchants"
      currency="EUR"
      sourceLabels={{
        sourceBank: 'Bank',
        sourceReceipt: 'Receipt',
        sourceGmailInbox: 'Gmail',
        sourceCrypto: 'Crypto',
      }}
      sortLabels={{ sortByAmount: 'Amount', sortByAverage: 'Average', sortByOperations: 'Ops' }}
      columnLabels={{
        merchant: 'Merchant',
        source: 'Source',
        operations: 'Operations',
        average: 'Average',
        amount: 'Amount',
        lastOperation: 'Last',
      }}
      emptyLabel="No data"
      focusId={focusId}
    />,
  );
}

describe('TopMerchantsLeaderboard', () => {
  it('marks each row as a focus target keyed by merchant name', () => {
    // Stoic advice about a habit links at `?focus=merchant:<name>`; aggregate
    // row ids carry source and currency too, so the name is the shared handle.
    const { container } = renderLeaderboard([row({})]);

    expect(container.querySelector('[data-attention="merchant:café einstein"]')).not.toBeNull();
  });

  it('draws the linked merchant even when the ranking cut it off', () => {
    const many = Array.from({ length: 70 }, (_, index) =>
      row({ id: `row-${index}`, merchant: `Merchant ${index}`, total: 1000 - index }),
    );
    const { container } = renderLeaderboard(many, 'merchant:merchant 68');

    expect(container.querySelectorAll('tbody tr')).toHaveLength(61);
    expect(container.querySelector('[data-attention="merchant:merchant 68"]')).not.toBeNull();
  });
});
