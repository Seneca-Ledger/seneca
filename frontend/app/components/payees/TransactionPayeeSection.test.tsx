// @vitest-environment jsdom
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/app/components/dashboard/test-setup';

const api = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn() }));
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), custom: vi.fn(), dismiss: vi.fn() }),
);
// The merge offer is accepted at once, so the test sees what accepting it does.
const offerAction = vi.hoisted(() => vi.fn((options: { onApply: () => void }) => options.onApply()));

vi.mock('@/app/lib/api', () => ({ default: api }));
vi.mock('react-hot-toast', () => ({ default: toast }));
vi.mock('./offer-action-toast', () => ({ offerAction }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
// "filesAs" keeps its placeholder so the test can see which category name went in.
const label = vi.hoisted(() => (key: string) => (key === 'filesAs' ? 'filesAs {{category}}' : key));
vi.mock('@/app/i18n', () => ({
  // Every string is its own key, so the test reads which text was meant.
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key) => ({ value: label(String(key)), toString: () => label(String(key)) }) }),
  useLocale: () => ({ locale: 'en' }),
}));

import { TransactionPayeeSection } from './TransactionPayeeSection';

const TAKEN_BY = '0b0c3f6e-1111-4222-8333-444455556666';
const ACME = {
  id: 'payee-acme',
  name: 'ACME MARKT',
  mode: 'auto',
  category: null,
  defaultCategory: { id: 'cat-food', name: 'Groceries', source: 'history' },
  countryCode: null,
  vatId: null,
  vatIdStatus: null,
  vatIdName: null,
  vatIdCheckedAt: null,
  supplyType: null,
  transactionCount: 12,
  lastSeen: '2026-10-01',
};
const CATEGORIES = [
  { id: 'cat-food', name: 'Groceries' },
  { id: 'cat-home', name: 'Household' },
];

const payeeIs = (payee: Record<string, unknown>) =>
  api.get.mockImplementation((url: string) => Promise.resolve({ data: url === `/payees/${ACME.id}` ? payee : {} }));

const renderSection = (transactionCategoryId: string | null = null) =>
  renderWithQuery(
    <TransactionPayeeSection
      transactionId="tx-1"
      payee={{ id: ACME.id, name: ACME.name }}
      counterpartyName="ACME MARKT 6334 //EXAMPLETOWN"
      categories={CATEGORIES}
      transactionCategoryId={transactionCategoryId}
    />,
  );

describe('TransactionPayeeSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    payeeIs(ACME);
    api.patch.mockResolvedValue({ data: { ...ACME, categoryId: null } });
    api.post.mockResolvedValue({ data: { merged: 1 } });
  });

  it('shows what the payee files as and how many rows it has', async () => {
    renderSection();

    const section = screen.getByTestId('transaction-payee');
    expect(section).toHaveTextContent(ACME.name);
    await waitFor(() => expect(section).toHaveTextContent('filesAs Groceries'));
    expect(section).toHaveTextContent('transactionsCount');
  });

  it('shows no payee settings on a row without a payee', () => {
    renderWithQuery(
      <TransactionPayeeSection
        transactionId="tx-1"
        payee={null}
        counterpartyName="Invoice number 2955"
        categories={CATEGORIES}
        transactionCategoryId={null}
      />,
    );

    expect(screen.getByTestId('transaction-payee')).toHaveTextContent('—');
    expect(screen.queryByRole('button', { name: 'vatDetails' })).not.toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('renames the payee', async () => {
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'rename' }), { target: { value: 'ACME' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() => expect(api.patch).toHaveBeenCalledWith(`/payees/${ACME.id}`, { name: 'ACME' }));
  });

  it('merges into the payee that already has the new name', async () => {
    api.patch.mockRejectedValue({
      response: { status: 409, data: { code: 'PAYEE_NAME_TAKEN', payeeId: TAKEN_BY } },
    });
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'rename' }), { target: { value: 'Acme Store' } });
    fireEvent.click(screen.getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(`/payees/${TAKEN_BY}/merge`, { sourceIds: [ACME.id] }),
    );
    await waitFor(() => expect(screen.getByTestId('transaction-payee')).toHaveTextContent('Acme Store'));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('pins "always" to what the payee files as now', async () => {
    renderSection();
    await screen.findByText(/filesAs Groceries/);

    selectOption(screen.getByRole('combobox'), 'modeAlways');

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(`/payees/${ACME.id}`, { mode: 'always', categoryId: 'cat-food' }),
    );
  });

  it('asks for the category of "always" when nothing names one yet', async () => {
    payeeIs({ ...ACME, defaultCategory: null });
    renderSection();
    await screen.findByText(/noDefault/);

    selectOption(screen.getByRole('combobox'), 'modeAlways');

    expect(await screen.findByLabelText('pickCategory')).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('saves a country and VAT id, upper-casing the country', async () => {
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'vatDetails' }));
    const form = await screen.findByTestId('payee-vat-form');
    fireEvent.change(within(form).getByLabelText('countryCode'), { target: { value: 'pl' } });
    fireEvent.change(within(form).getByLabelText('vatId'), { target: { value: ' PL555 ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'save' }));

    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith(`/payees/${ACME.id}`, {
        countryCode: 'PL',
        vatId: 'PL555',
        supplyType: null,
      }),
    );
  });

  it('refuses a country that is not two letters', async () => {
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'vatDetails' }));
    const form = await screen.findByTestId('payee-vat-form');
    fireEvent.change(within(form).getByLabelText('countryCode'), { target: { value: 'P1' } });
    fireEvent.click(within(form).getByRole('button', { name: 'save' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('countryCodeInvalid'));
    expect(api.patch).not.toHaveBeenCalled();
  });

  it('marks a number VIES calls invalid and checks it again on request', async () => {
    payeeIs({ ...ACME, countryCode: 'PL', vatId: 'PL555', vatIdStatus: 'invalid', vatIdCheckedAt: '2026-10-11' });
    api.post.mockResolvedValue({
      // The write answers the stored payee (PayeeRecord), with its category id.
      data: {
        ...ACME,
        categoryId: null,
        countryCode: 'PL',
        vatId: 'PL555',
        vatIdStatus: 'valid',
        vatIdCheckedAt: '2026-10-12',
      },
    });
    renderSection();

    expect(await screen.findByTestId('payee-vat-status')).toHaveTextContent('vatInvalid');
    fireEvent.click(screen.getByRole('button', { name: 'vatRecheck' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/payees/${ACME.id}/vat-check`, {}));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('vatSavedValid'));
  });
});
