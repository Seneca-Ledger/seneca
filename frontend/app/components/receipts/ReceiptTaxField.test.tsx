// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReceiptTax, TaxRateItem } from '@/app/lib/contracts';
import { apiResponse } from '@/app/test/api-response';
import { renderWithQuery } from '@/app/test/query-wrapper';
import { selectOption } from '@/app/test/select';
import { ReceiptTaxField } from './ReceiptTaxField';

const apiGet = vi.hoisted(() => vi.fn());
const apiPut = vi.hoisted(() => vi.fn());

vi.mock('@/app/lib/api', () => ({ default: { get: apiGet, put: apiPut } }));
vi.mock('@/app/hooks/useWorkspaceId', () => ({ useWorkspaceId: () => 'ws-1' }));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));
vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy(
      {},
      {
        get: (_target, key) => ({
          value: String(key),
          toString: () => String(key),
        }),
      },
    ),
  useLocale: () => ({ locale: 'en' }),
}));

function rate(
  overrides: Partial<TaxRateItem> & Pick<TaxRateItem, 'id' | 'name' | 'rate'>,
): TaxRateItem {
  return {
    isDefault: false,
    isEnabled: true,
    jurisdictionId: null,
    code: null,
    kind: 'standard',
    validFrom: '2020-01-01',
    validTo: null,
    isInclusive: true,
    isReverseCharge: false,
    ...overrides,
  };
}

const standard = rate({
  id: 'rate-standard',
  name: 'Standard 20%',
  rate: '20.00',
  isDefault: true,
});
const reduced = rate({
  id: 'rate-reduced',
  name: 'Reduced 7%',
  rate: '7.00',
  kind: 'reduced',
});

function tax(overrides: Partial<ReceiptTax> = {}): ReceiptTax {
  return {
    transactionId: 'txn-1',
    assessable: true,
    locked: false,
    taxRateId: standard.id,
    taxSource: 'default',
    taxAmount: '20.00',
    ...overrides,
  };
}

function answer(receiptTax: ReceiptTax) {
  apiGet.mockImplementation(async (url: string) =>
    apiResponse(url === '/tax/settings/rates' ? [standard, reduced] : receiptTax),
  );
}

const renderField = () =>
  renderWithQuery(
    <ReceiptTaxField id="receipt-tax" receiptId="receipt-1" date="2026-10-16" currency="EUR" />,
  );

describe('ReceiptTaxField', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPut.mockReset();
  });

  it('shows the automatic rate and asks for the rates in force on the receipt date', async () => {
    answer(tax());
    renderField();

    expect(await screen.findByText(/20\.00.*taxSourceDefault \(Standard 20%\)/)).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith(
      '/tax/settings/rates',
      expect.objectContaining({ params: { date: '2026-10-16' } }),
    );
  });

  it('pins a picked rate, and automatic hands the row back to the rules', async () => {
    answer(tax());
    apiPut.mockResolvedValueOnce(
      apiResponse(tax({ taxRateId: reduced.id, taxSource: 'manual', taxAmount: '6.54' })),
    );
    renderField();
    await screen.findByText(/taxSourceDefault/);

    selectOption(screen.getByRole('combobox', { name: 'tax' }), 'Reduced 7%');
    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/receipts/receipt-1/tax', {
        taxRateId: reduced.id,
      }),
    );
    expect(await screen.findByText(/6\.54.*taxSourceManual/)).toBeTruthy();

    apiPut.mockResolvedValueOnce(apiResponse(tax()));
    selectOption(screen.getByRole('combobox', { name: 'tax' }), 'taxAutomatic');
    await waitFor(() =>
      expect(apiPut).toHaveBeenLastCalledWith('/receipts/receipt-1/tax', {
        taxRateId: null,
      }),
    );
  });

  it('is disabled and says why when the workspace does not charge VAT', async () => {
    answer(
      tax({
        assessable: false,
        taxRateId: null,
        taxSource: null,
        taxAmount: null,
      }),
    );
    renderField();

    expect(await screen.findByText('taxNotRegistered')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'tax' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
  });
});
