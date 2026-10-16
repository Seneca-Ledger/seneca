// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payable } from '@/app/lib/payables-api';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { MarkPaidDialog } from './MarkPaidDialog';
import { categoryItem, walletItem } from '@/app/test/fixtures/contracts';

const apiMocks = vi.hoisted(() => ({
  paymentCandidates: vi.fn(),
  payments: vi.fn(),
  apiQuery: vi.fn(),
}));

vi.mock('@/app/lib/payables-api', () => ({
  payablesApi: { paymentCandidates: apiMocks.paymentCandidates, payments: apiMocks.payments },
}));

vi.mock('@/app/lib/query-fn', () => ({
  apiQuery: apiMocks.apiQuery,
}));

vi.mock('@/app/hooks/useWorkspaceId', () => ({
  useWorkspaceId: () => 'workspace-1',
}));

// Every label reads as its own key, so the test finds controls by key.
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key) => ({ value: String(key) }) }) as Record<
      string,
      { value: string }
    >,
  useLocale: () => ({ locale: 'en' }),
}));

const payable = {
  id: 'payable-1',
  direction: 'payable',
  vendor: 'Acme',
  amount: '120.00',
  paidAmount: '0.00',
  currency: 'eur',
} as Payable;

const candidate = (id: string, vendorMatch = false) => ({
  id,
  transactionDate: '2026-09-20',
  amount: '120.00',
  currency: 'EUR',
  counterpartyName: `Payee ${id}`,
  paymentPurpose: 'Invoice',
  vendorMatch,
});

function renderDialog(bill: Payable = payable) {
  const onConfirm = vi.fn();
  const onRemovePayment = vi.fn();
  renderWithQuery(
    <MarkPaidDialog
      payable={bill}
      submitting={false}
      onClose={vi.fn()}
      onConfirm={onConfirm}
      onRemovePayment={onRemovePayment}
    />,
  );
  return { onConfirm, onRemovePayment };
}

const amountField = () => screen.getByLabelText('amount', { selector: 'input' });

describe('MarkPaidDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.payments.mockResolvedValue([]);
    apiMocks.apiQuery.mockImplementation(async ({ url }: { url: string }) =>
      url === '/wallets'
        ? [
            walletItem({ id: 'wallet-usd', name: 'Dollars', currency: 'USD' }),
            walletItem({ id: 'wallet-eur', name: 'Till', currency: 'EUR' }),
          ]
        : [
            categoryItem({ id: 'cat-in', name: 'Sales', type: 'income' }),
            categoryItem({ id: 'cat-out', name: 'Services' }),
          ],
    );
  });

  it('opens on the matching bank transactions and links the chosen one', async () => {
    apiMocks.paymentCandidates.mockResolvedValue([candidate('tx-1', true), candidate('tx-2')]);
    const { onConfirm } = renderDialog();

    expect(await screen.findByText('Payee tx-1 — Invoice')).toBeInTheDocument();
    expect(screen.getByText('vendorMatch')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Payee tx-2/));
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    expect(onConfirm).toHaveBeenCalledWith(payable, {
      kind: 'full',
      payload: { linkedTransactionId: 'tx-2' },
    });
  });

  it('records a cash payment from a wallet in the bill currency', async () => {
    apiMocks.paymentCandidates.mockResolvedValue([]);
    const { onConfirm } = renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'modeCash' }));

    // The only wallet in the bill's currency is preselected; the dollar one is not offered.
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'wallet' })).toHaveTextContent('Till'));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'wallet' }));
    expect(screen.queryByRole('option', { name: 'Dollars' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Till' }));

    // Paying out, so the income category is not offered either.
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'category' }));
    expect(screen.queryByRole('option', { name: 'Sales' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: 'Services' }));

    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    expect(onConfirm).toHaveBeenCalledWith(payable, {
      kind: 'full',
      payload: {
        payFromWalletId: 'wallet-eur',
        paidOn: new Date().toISOString().slice(0, 10),
        categoryId: 'cat-out',
      },
    });
  });

  it('asks where the money of a payment marked without it went, instead of for another payment', async () => {
    apiMocks.paymentCandidates.mockResolvedValue([]);
    apiMocks.payments.mockResolvedValue([
      {
        id: 'payment-1',
        payableId: 'payable-1',
        amount: '120.00',
        feeAmount: '0.00',
        paidOn: '2026-10-16',
        transactionId: null,
        comment: null,
        createdAt: '2026-10-16T08:00:00.000Z',
      },
    ]);
    const { onConfirm } = renderDialog({ ...payable, paidAmount: '120.00', status: 'paid' } as Payable);

    expect(await screen.findByText('bookIntro')).toBeInTheDocument();
    expect(screen.getByText(/notInAccount/)).toBeInTheDocument();
    // Nothing is left to pay, and "just mark it" would leave the money nowhere again.
    expect(screen.queryByLabelText('amount', { selector: 'input' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'modePlain' })).toBeNull();

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'wallet' })).toHaveTextContent('Till'));
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: 'payable-1' }), {
      kind: 'book',
      paymentId: 'payment-1',
      payload: { payFromWalletId: 'wallet-eur', categoryId: undefined },
    });
  });

  it('books a sale paid in hand as cash kept in no wallet when no wallet has its currency', async () => {
    apiMocks.paymentCandidates.mockResolvedValue([]);
    apiMocks.payments.mockResolvedValue([
      {
        id: 'payment-1',
        payableId: 'payable-1',
        amount: '3500.00',
        feeAmount: '0.00',
        paidOn: '2026-10-16',
        transactionId: null,
        comment: null,
        createdAt: '2026-10-16T08:00:00.000Z',
      },
    ]);
    const sale = {
      ...payable,
      direction: 'receivable',
      vendor: 'Mac Mini buyer',
      amount: '3500.00',
      paidAmount: '3500.00',
      currency: 'ils',
      status: 'paid',
    } as Payable;
    const { onConfirm } = renderDialog(sale);

    expect(await screen.findByText('bookIntro')).toBeInTheDocument();
    // No wallet in shekels: cash in hand is preselected, and the payment's own day stands.
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'wallet' })).toHaveTextContent('inHand'));
    expect(screen.getByText('inHandHint')).toBeInTheDocument();
    expect(screen.queryByLabelText('paidOn')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ id: 'payable-1' }), {
      kind: 'book',
      paymentId: 'payment-1',
      payload: { inHand: true, categoryId: undefined },
    });
  });

  it('offers cash in hand beside the wallets and records a payment with it', async () => {
    apiMocks.paymentCandidates.mockResolvedValue([]);
    const { onConfirm } = renderDialog();

    fireEvent.click(await screen.findByRole('button', { name: 'modeCash' }));
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'wallet' })).toHaveTextContent('Till'));
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'wallet' }));
    fireEvent.click(screen.getByRole('option', { name: 'inHand' }));
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    expect(onConfirm).toHaveBeenCalledWith(payable, {
      kind: 'full',
      payload: { inHand: true, paidOn: new Date().toISOString().slice(0, 10), categoryId: undefined },
    });
  });

  it('falls back to a plain status change when nothing matches', async () => {
    apiMocks.paymentCandidates.mockResolvedValue([]);
    const { onConfirm } = renderDialog();

    expect(await screen.findByText('plainHint')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    expect(onConfirm).toHaveBeenCalledWith(payable, { kind: 'full', payload: {} });
  });

  it('opens on the outstanding amount and records less than it as one payment', async () => {
    apiMocks.paymentCandidates.mockResolvedValue([candidate('tx-1')]);
    const { onConfirm } = renderDialog();

    expect(await screen.findByText('Payee tx-1 — Invoice')).toBeInTheDocument();
    expect(amountField()).toHaveValue(120);

    fireEvent.change(amountField(), { target: { value: '50' } });
    expect(screen.getByText('partialHint')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));

    expect(onConfirm).toHaveBeenCalledWith(payable, {
      kind: 'payment',
      payload: { amount: 50, linkedTransactionId: 'tx-1' },
    });
  });

  it('shows what is already paid and offers to take a payment back', async () => {
    apiMocks.paymentCandidates.mockResolvedValue([]);
    apiMocks.payments.mockResolvedValue([
      { id: 'pay-1', payableId: 'payable-1', amount: '40.00', feeAmount: '0.00', paidOn: '2026-09-28' },
    ]);
    const partlyPaid = { ...payable, paidAmount: '40.00', status: 'partially_paid' } as Payable;
    const { onConfirm, onRemovePayment } = renderDialog(partlyPaid);

    // The form opens on the rest of the bill, not on its whole amount.
    expect(await screen.findByText('paymentsTitle')).toBeInTheDocument();
    await waitFor(() => expect(amountField()).toHaveValue(80));

    fireEvent.click(screen.getByRole('button', { name: 'removePayment' }));
    expect(onRemovePayment).toHaveBeenCalledWith(partlyPaid, 'pay-1');

    fireEvent.click(screen.getByRole('button', { name: 'confirm' }));
    expect(onConfirm).toHaveBeenCalledWith(partlyPaid, { kind: 'full', payload: {} });
  });
});
