// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TableMoneyTotal } from '../hooks/useTableMoneyTotal';
import type { CustomTable } from '../utils/tableTypes';
import { TablePageHeader, type TablePageHeaderLabels } from './TablePageHeader';

const appLocale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

const labels: TablePageHeaderLabels = {
  back: 'Back',
  balanceMissingRates: 'Without {{currencies}}: no exchange rate',
  rename: 'Rename',
  rows: '{{count}} rows',
  sources: { manual: 'Manual' },
  sourceKinds: {},
  syncedAt: 'Synced {{date}}',
  untitled: 'Untitled',
};

const table = {
  id: 'table-1',
  name: 'Ads spend',
  description: null,
  source: 'manual',
  categoryId: 'cat-ads',
  category: { id: 'cat-ads', name: 'Advertising' },
  columns: [],
} as unknown as CustomTable;

const renderHeader = (moneyTotal: TableMoneyTotal | null = null) =>
  render(
    <TablePageHeader
      table={table}
      total={3}
      moneyTotal={moneyTotal}
      onBack={vi.fn()}
      onRename={vi.fn()}
      labels={labels}
    />,
  );

describe('TablePageHeader', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it("names the table's system category in the reader's language", () => {
    appLocale.current = 'ru';
    renderHeader();

    expect(screen.getByText('Реклама')).toBeInTheDocument();
    expect(screen.queryByText('Advertising')).toBeNull();
  });

  it('shows the stored name in English', () => {
    renderHeader();

    expect(screen.getByText('Advertising')).toBeInTheDocument();
  });

  it("shows the table's balance under the title, with a typographic minus", () => {
    renderHeader({ column: 'amount', currency: 'USD', total: -1250.5, missing: [] });

    expect(screen.getByText('−$1,250.50')).toHaveClass('seneca-ct__balance-value--down');
  });

  it('marks a positive balance as up and leaves zero neutral', () => {
    const { unmount } = renderHeader({ column: 'amount', currency: 'USD', total: 80, missing: [] });
    expect(screen.getByText('$80.00')).toHaveClass('seneca-ct__balance-value--up');
    unmount();

    renderHeader({ column: 'amount', currency: 'USD', total: 0, missing: [] });
    const zero = screen.getByText('$0.00');
    expect(zero).not.toHaveClass('seneca-ct__balance-value--up');
    expect(zero).not.toHaveClass('seneca-ct__balance-value--down');
  });

  it('names the currencies left out of the balance', () => {
    renderHeader({ column: 'amount', currency: 'USD', total: 10, missing: ['ABC', 'XYZ'] });

    expect(screen.getByText('Without ABC, XYZ: no exchange rate')).toBeInTheDocument();
  });

  it('draws no balance for a table without a money column', () => {
    const { container } = renderHeader({ column: null, currency: 'USD', total: null, missing: [] });

    expect(container.querySelector('.seneca-ct__balance')).toBeNull();
  });
});
