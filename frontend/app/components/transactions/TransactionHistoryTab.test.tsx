// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionHistory } from '@/app/lib/contracts';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { TransactionHistoryTab } from './TransactionHistoryTab';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock('@/app/lib/api', () => ({ default: api, apiBaseUrl: '/api/v1' }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('react-hot-toast', () => ({ default: toasts }));
vi.mock('@/app/lib/invalidate-document-lists', () => ({ invalidateFinancialData: vi.fn() }));
vi.mock('@/app/i18n', async () => {
  const { autoDictionary, value } = await import(
    '@/app/components/dashboard/__tests__/intlayer-mock'
  );
  return {
    useLocale: () => ({ locale: 'en' }),
    useIntlayer: () =>
      autoDictionary({
        you: value('You'),
        rule: value('Rule “{{name}}”'),
        fieldCategory: value('Category'),
        fieldPrivate: value('Visibility'),
        noCategory: value('No category'),
        private: value('Private'),
        visible: value('Visible to everyone'),
        confirmed: value('Confirmed'),
        unconfirmed: value('Not confirmed'),
        undo: value('Put back'),
        undone: value('Change put back'),
        undoFailed: value('This change can no longer be put back'),
        ruleApplied: value('Applied to this transaction'),
        originStatement: value('From “{{name}}”'),
      }),
  };
});

const statement = 'example-bank-may.pdf';
const groceries = 'Groceries';
const cafe = 'Cafe';
const entry = (
  id: string,
  fields: Partial<TransactionHistory['entries'][number]>,
): TransactionHistory['entries'][number] => ({
  id,
  at: '2026-05-12T10:30:00.000Z',
  kind: 'changed',
  actor: { kind: 'you', name: null },
  changes: [],
  parts: null,
  canUndo: false,
  ...fields,
});
const answer: TransactionHistory = {
  origin: { at: '2026-05-10T08:00:00.000Z', statementName: statement },
  currency: 'EUR',
  entries: [
    entry('ev-category', {
      changes: [
        { field: 'category', before: groceries, after: cafe },
        { field: 'private', before: 'false', after: 'true' },
      ],
      canUndo: true,
    }),
    entry('ev-rule', { kind: 'rule', actor: { kind: 'rule', name: 'Coffee' } }),
    entry('ev-member', {
      actor: { kind: 'member', name: 'Member Two' },
      changes: [{ field: 'category', before: null, after: groceries }],
    }),
  ],
};

describe('TransactionHistoryTab', () => {
  beforeEach(() => {
    api.get.mockReset().mockResolvedValue({ data: answer });
    api.post.mockReset().mockResolvedValue({ data: answer });
    toasts.success.mockReset();
    toasts.error.mockReset();
  });

  it('tells each change as who, then field: was → now, down to where the row came from', async () => {
    renderWithQuery(<TransactionHistoryTab transactionId="tx-1" />);

    expect(await screen.findByText(`From “${statement}”`)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/transactions/tx-1/history', expect.anything());
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Visible to everyone')).toBeInTheDocument();
    expect(screen.getByText('Private')).toBeInTheDocument();
    expect(screen.getByText('Rule “Coffee”')).toBeInTheDocument();
    expect(screen.getByText('Applied to this transaction')).toBeInTheDocument();
    expect(screen.getByText('Member Two')).toBeInTheDocument();
    expect(screen.getByText('No category')).toBeInTheDocument();
    // Only the change that still holds can be put back.
    expect(screen.getAllByRole('button', { name: 'Put back' })).toHaveLength(1);
  });

  it('titles a lone change by its field, and a lone yes/no change by its new state', async () => {
    api.get.mockResolvedValue({
      data: {
        ...answer,
        entries: [
          entry('ev-confirm', { changes: [{ field: 'confirmed', before: 'false', after: 'true' }] }),
          entry('ev-cafe', { changes: [{ field: 'category', before: groceries, after: cafe }] }),
        ],
      },
    });
    renderWithQuery(<TransactionHistoryTab transactionId="tx-1" />);

    expect(await screen.findByText('Confirmed')).toBeInTheDocument();
    expect(screen.queryByText('Not confirmed')).not.toBeInTheDocument();
    expect(screen.getByText('Category')).toBeInTheDocument();
    expect(screen.getByText(groceries)).toBeInTheDocument();
    expect(screen.getByText(cafe)).toBeInTheDocument();
  });

  it('puts a change back and says so', async () => {
    renderWithQuery(<TransactionHistoryTab transactionId="tx-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Put back' }));

    await waitFor(() => expect(toasts.success).toHaveBeenCalledWith('Change put back'));
    expect(api.post).toHaveBeenCalledWith('/transactions/tx-1/history/ev-category/undo');
  });

  it('says when a change can no longer be put back', async () => {
    api.post.mockRejectedValue({ response: { status: 409 } });
    renderWithQuery(<TransactionHistoryTab transactionId="tx-1" />);

    fireEvent.click(await screen.findByRole('button', { name: 'Put back' }));

    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith('This change can no longer be put back'),
    );
  });
});
