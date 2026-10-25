/**
 * Answers for the tax-return view's endpoints, shaped like their contracts:
 * the view checks every answer, so a partial one reads as a failed load.
 */

import type { TaxReturnPreview, TaxReturnRecord, VatFilingSettings } from '@/app/lib/contracts';

export const TOTALS: TaxReturnPreview = {
  outputTax: 1200,
  inputTax: 500,
  netPayable: 700,
  currency: 'KZT',
  lines: [
    {
      transactionId: 'a',
      date: '2026-02-10',
      counterparty: 'ACME Store',
      direction: 'input',
      currency: 'KZT',
      taxAmount: 500,
      netAmount: 4500,
      exchangeRate: 1,
      taxAmountConverted: 500,
    },
    {
      transactionId: 'b',
      date: '2026-02-11',
      counterparty: 'Polish supplier',
      direction: 'reverse_charge',
      currency: 'EUR',
      taxAmount: 190,
      netAmount: 1000,
      exchangeRate: 500,
      taxAmountConverted: 95000,
    },
  ],
  missingRates: [],
};

/** TaxReturnRecord: the saved return of the period. */
export function returnRecord(status: TaxReturnRecord['status']): TaxReturnRecord {
  return {
    id: 'ret-1',
    jurisdictionId: 'jur-1',
    periodStart: '2026-01-01',
    periodEnd: '2026-03-31',
    status,
    outputTax: '1200',
    inputTax: '500',
    netPayable: '700',
    currency: 'KZT',
    filedAt: status === 'filed' ? '2026-04-10T10:00:00.000Z' : null,
    snapshot: null,
    createdAt: '2026-04-01T10:00:00.000Z',
  };
}

/** VatFilingSettings; a null frequency is the jurisdiction's usual one. */
export function vatFiling(frequency: VatFilingSettings['frequency']): VatFilingSettings {
  return {
    frequency,
    isDefault: frequency === null,
    extension: false,
    extensionName: null,
    deadlinesKnown: true,
    knownFrequencies: ['monthly', 'quarterly'],
  };
}
