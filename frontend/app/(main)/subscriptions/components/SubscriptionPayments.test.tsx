import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { type CandidateRow, SubscriptionPayments } from './SubscriptionPayments';

const apiQueryDecoded = vi.hoisted(() => vi.fn());
const uploadScan = vi.hoisted(() => vi.fn());

vi.mock('@/app/i18n', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/i18n')>()),
  useLocale: () => ({ locale: 'en' }),
}));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('@/app/lib/query-fn-schema', () => ({ apiQueryDecoded }));
vi.mock('@/app/(main)/statements/components/statement-upload', async importOriginal => ({
  ...(await importOriginal<typeof import('@/app/(main)/statements/components/statement-upload')>()),
  uploadReceiptScanFiles: uploadScan,
}));
vi.mock('@/app/components/CustomDatePicker', () => ({
  default: ({ id, onChange }: { id?: string; onChange: (value: string) => void }) => (
    <input aria-label="Date" id={id} onChange={event => onChange(event.target.value)} />
  ),
}));

const VENDOR = 'ACME Music';
const row = (overrides: Partial<CandidateRow> = {}): CandidateRow => ({
  transactionId: 'tx-1',
  counterpartyName: 'ACME MUSIC*PREMIUM',
  transactionDate: '2026-09-14',
  amount: 9.99,
  currency: 'USD',
  matchesVendor: true,
  ...overrides,
});
const other = row({
  transactionId: 'tx-2',
  counterpartyName: 'Example Grocer',
  matchesVendor: false,
});

function renderPayments(overrides: Partial<React.ComponentProps<typeof SubscriptionPayments>> = {}) {
  const handlers = {
    onAddManual: vi.fn(),
    onAddRows: vi.fn(),
    onLinkRow: vi.fn(),
    onRemove: vi.fn(),
  };
  renderWithQuery(
    <SubscriptionPayments
      payments={[]}
      vendorName={VENDOR}
      defaultAmount={9.99}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe('SubscriptionPayments', () => {
  beforeEach(() => {
    apiQueryDecoded.mockReset();
    uploadScan.mockReset();
    // The scan answers with the document already read, as `/statements/upload-receipt` does.
    uploadScan.mockImplementation(
      async ({ onBatchCreated }: { onBatchCreated: (offset: number, ids: string[]) => void }) =>
        onBatchCreated(0, ['st-1']),
    );
  });

  it('adds a payment typed in, at the subscription price when no amount is given', () => {
    const { onAddManual } = renderPayments();

    fireEvent.click(screen.getByRole('button', { name: 'Add payment' }));
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-08-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onAddManual).toHaveBeenCalledWith('2026-08-01', 9.99);
  });

  it('picks a row from uploaded statements, leaving out rows already picked', async () => {
    apiQueryDecoded.mockResolvedValue([row(), other]);
    const { onAddRows } = renderPayments({ pickedTransactionIds: ['tx-2'] });

    fireEvent.click(screen.getByRole('button', { name: 'From statements' }));
    fireEvent.click(await screen.findByRole('button', { name: /ACME MUSIC\*PREMIUM/ }));

    expect(screen.queryByText('Example Grocer')).toBeNull();
    expect(apiQueryDecoded).toHaveBeenCalledWith(
      expect.objectContaining({ params: { vendorName: VENDOR, statementId: undefined } }),
    );
    await waitFor(() => expect(onAddRows).toHaveBeenCalledWith([row()]));
  });

  it('links a typed-in payment to the row picked for it', async () => {
    apiQueryDecoded.mockResolvedValue([row()]);
    const { onLinkRow, onAddRows } = renderPayments({
      payments: [
        { key: 'charge-1', date: '2026-09-14', amount: 9.99, currency: 'USD', linked: false },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Link' }));
    fireEvent.click(await screen.findByRole('button', { name: /ACME MUSIC\*PREMIUM/ }));

    await waitFor(() => expect(onLinkRow).toHaveBeenCalledWith('charge-1', row()));
    expect(onAddRows).not.toHaveBeenCalled();
  });

  const uploadFile = () => {
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'invoice.pdf')] } });
  };

  it('uploads through the same scan as Statements and adds the vendor rows at once', async () => {
    apiQueryDecoded.mockResolvedValue([row(), other]);
    const { onAddRows } = renderPayments();

    uploadFile();

    await waitFor(() => expect(onAddRows).toHaveBeenCalledWith([row()]));
    expect(uploadScan).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }));
    expect(apiQueryDecoded).toHaveBeenCalledWith(
      expect.objectContaining({ params: { vendorName: VENDOR, statementId: 'st-1' } }),
    );
    expect(screen.getByText('Payments linked from the statement: 1.')).toBeInTheDocument();
  });

  it('records the payment even when the card is closed while the scan runs', async () => {
    let finishScan: () => void = () => undefined;
    uploadScan.mockImplementation(
      ({ onBatchCreated }: { onBatchCreated: (offset: number, ids: string[]) => void }) =>
        new Promise<void>(resolve => {
          finishScan = () => {
            onBatchCreated(0, ['st-1']);
            resolve();
          };
        }),
    );
    apiQueryDecoded.mockResolvedValue([other]);
    const handlers = { onAddManual: vi.fn(), onAddRows: vi.fn(), onRemove: vi.fn() };
    const { unmount } = renderWithQuery(
      <SubscriptionPayments payments={[]} vendorName={VENDOR} defaultAmount={9.99} {...handlers} />,
    );

    uploadFile();
    unmount();
    finishScan();

    await waitFor(() => expect(handlers.onAddRows).toHaveBeenCalledWith([other]));
  });

  it('adds the single row of an uploaded document even under another payee name', async () => {
    apiQueryDecoded.mockResolvedValue([other]);
    const { onAddRows } = renderPayments();

    uploadFile();

    await waitFor(() => expect(onAddRows).toHaveBeenCalledWith([other]));
  });

  it('shows the rows to choose from when several came in and none look like the vendor', async () => {
    const third = row({ transactionId: 'tx-3', counterpartyName: 'Corner Shop', matchesVendor: false });
    apiQueryDecoded.mockResolvedValue([other, third]);
    const { onAddRows } = renderPayments();

    uploadFile();

    expect(await screen.findByRole('button', { name: /Corner Shop/ })).toBeInTheDocument();
    expect(onAddRows).not.toHaveBeenCalled();
  });

  it('says so when the document could not be read', async () => {
    uploadScan.mockRejectedValue(new Error('The statement could not be read.'));
    renderPayments();

    uploadFile();

    expect(await screen.findByText('The statement could not be read.')).toBeInTheDocument();
  });

  it('says so when the document was read but holds no amount', async () => {
    apiQueryDecoded.mockResolvedValue([]);
    const { onAddRows } = renderPayments();

    uploadFile();

    expect(await screen.findByText('The statement could not be read.')).toBeInTheDocument();
    expect(onAddRows).not.toHaveBeenCalled();
  });
});
