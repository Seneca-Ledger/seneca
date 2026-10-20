import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReceiptRecord, ReceiptSplitSuggestion } from '@/app/lib/api';
import { ReceiptTransactionMatch } from './ReceiptTransactionMatch';

const api = vi.hoisted(() => ({
  splitSuggestion: vi.fn(),
  splitByLineItems: vi.fn(),
  transactionMatches: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/app/lib/api', () => ({
  default: { post: api.post },
  receiptsApi: {
    splitSuggestion: api.splitSuggestion,
    splitByLineItems: api.splitByLineItems,
    transactionMatches: api.transactionMatches,
  },
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/app/i18n', async () => ({
  useLocale: () => ({ locale: 'en' }),
  useIntlayer: (await vi.importActual<typeof import('react-intlayer')>('react-intlayer'))
    .useIntlayer,
}));

const receipt = {
  id: 'r1',
  status: 'approved',
  transactionId: 't1',
  parsedData: {
    lineItems: [
      { description: 'Milk', amount: 4 },
      { description: 'Shampoo', amount: 6 },
    ],
  },
} as unknown as ReceiptRecord;

const categories = [
  { id: 'food', name: 'Food', isEnabled: true },
  { id: 'home', name: 'Household', isEnabled: true },
];

const suggestion = (overrides: Partial<ReceiptSplitSuggestion> = {}): ReceiptSplitSuggestion => ({
  transactionId: 't1',
  total: 11,
  currency: 'EUR',
  parts: [],
  splittable: false,
  items: [
    { description: 'Milk', amount: 4, categoryId: 'food' },
    { description: 'Shampoo', amount: 6, categoryId: null },
  ],
  alreadySplit: false,
  fallbackCategoryId: 'food',
  ...overrides,
});

const renderMatch = (onChanged = vi.fn(async () => undefined)) =>
  render(
    <ReceiptTransactionMatch
      receipt={receipt}
      categories={categories}
      saving={false}
      onApprove={vi.fn(async () => undefined)}
      onChanged={onChanged}
    />,
  );

describe('ReceiptTransactionMatch split by items', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lets the user move an item to another category before anything is booked', async () => {
    api.splitSuggestion.mockResolvedValue(suggestion());
    api.splitByLineItems.mockResolvedValue({});
    renderMatch();

    fireEvent.click(screen.getByRole('button', { name: 'Split by line items' }));

    // Both lines landed in Food (the open one via the fallback): nothing to split yet.
    await screen.findByText(/Food: €11\.00/);
    expect(screen.queryByRole('button', { name: 'Apply split' })).toBeNull();
    expect(api.splitByLineItems).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Category for “Shampoo”'));
    fireEvent.click(screen.getByRole('button', { name: 'Household' }));

    expect(screen.getByText(/Household: €6\.60/)).toBeTruthy();
    expect(screen.getByText(/Food: €4\.40/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Apply split' }));

    await waitFor(() =>
      expect(api.splitByLineItems).toHaveBeenCalledWith('r1', [
        { description: 'Milk', amount: 4, categoryId: 'food' },
        { description: 'Shampoo', amount: 6, categoryId: 'home' },
      ]),
    );
    expect(await screen.findByRole('button', { name: 'Undo split' })).toBeTruthy();
  });

  it('offers undo straight away when the receipt says its transaction is split', () => {
    render(
      <ReceiptTransactionMatch
        receipt={{ ...receipt, transactionSplit: true }}
        categories={categories}
        saving={false}
        onApprove={vi.fn(async () => undefined)}
        onChanged={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole('button', { name: 'Undo split' })).toBeTruthy();
    expect(api.splitSuggestion).not.toHaveBeenCalled();
  });

  it('offers to undo a split the transaction already has', async () => {
    api.splitSuggestion.mockResolvedValue(suggestion({ alreadySplit: true, items: [] }));
    api.post.mockResolvedValue({});
    const onChanged = vi.fn(async () => undefined);
    renderMatch(onChanged);

    fireEvent.click(screen.getByRole('button', { name: 'Split by line items' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo split' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/transactions/t1/unsplit'));
    expect(onChanged).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Split by line items' })).toBeTruthy();
  });
});
