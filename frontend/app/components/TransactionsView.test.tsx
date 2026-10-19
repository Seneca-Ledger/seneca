// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionsView, { type Transaction } from './TransactionsView';

const appLocale = vi.hoisted(() => ({ current: 'en' }));

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: appLocale.current }),
}));

const row = (isEnabled = true) =>
  ({
    id: 'tx-1',
    transactionDate: '2026-01-01',
    counterpartyName: 'Merchant',
    debit: '10.00',
    credit: null,
    currency: 'USD',
    category: { id: 'cat-ads', name: 'Advertising', isEnabled },
  }) as unknown as Transaction;

describe('TransactionsView', () => {
  beforeEach(() => {
    appLocale.current = 'en';
  });

  it("names a system category in the reader's language", () => {
    appLocale.current = 'ru';
    render(<TransactionsView transactions={[row()]} />);

    expect(screen.getByText('Реклама')).toBeInTheDocument();
    expect(screen.queryByText('Advertising')).toBeNull();
  });

  it('translates a disabled category as well', () => {
    appLocale.current = 'ru';
    render(<TransactionsView transactions={[row(false)]} />);

    expect(screen.getByText('Реклама — select category')).toBeInTheDocument();
  });

  it('shows the stored name in English', () => {
    render(<TransactionsView transactions={[row()]} />);

    expect(screen.getByText('Advertising')).toBeInTheDocument();
  });
});
