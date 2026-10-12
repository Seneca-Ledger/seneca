// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/app/i18n', () => ({
  useIntlayer: () =>
    new Proxy({}, { get: (_target, key) => ({ value: String(key), toString: () => String(key) }) }),
}));

import type { EInvoiceSummary } from '@/app/lib/api';
import { EInvoicePanel, einvoiceKind } from './EInvoicePanel';

const INVOICE: EInvoiceSummary = {
  syntax: 'cii',
  profile: 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0',
  meetsEn16931: true,
  typeCode: '380',
  number: '123456XX',
  dueDate: '2026-04-30',
  deliveryDate: null,
  iban: 'DE79000000001234567890',
  seller: { name: 'Seller GmbH', vatId: 'DE123456789', taxNumber: null, countryCode: 'DE' },
  reverseCharge: false,
  vat: [{ category: 'S', rate: 19, base: 100, tax: 19, exemptionReason: null }],
};

describe('EInvoicePanel', () => {
  it('names the kind of e-invoice', () => {
    expect(einvoiceKind(INVOICE)).toBe('XRechnung');
    expect(einvoiceKind({ ...INVOICE, profile: 'urn:cen.eu:en16931:2017' })).toBe('ZUGFeRD / Factur-X');
    expect(einvoiceKind({ ...INVOICE, syntax: 'ubl', profile: null })).toBe('UBL');
  });

  it('shows what the XML says, with the VAT lines', () => {
    render(<EInvoicePanel einvoice={INVOICE} issues={[]} currency="EUR" />);
    expect(screen.getByText('123456XX')).toBeInTheDocument();
    expect(screen.getByText('DE123456789')).toBeInTheDocument();
    expect(screen.getByText(/vatStandard 19 % · base 100.00 EUR · vat 19.00 EUR/)).toBeInTheDocument();
    expect(screen.queryByText('notEn16931')).not.toBeInTheDocument();
    expect(screen.queryByText('reverseCharge')).not.toBeInTheDocument();
  });

  it('warns about a profile that is not an e-invoice, totals that disagree, and says reverse charge', () => {
    render(
      <EInvoicePanel
        einvoice={{ ...INVOICE, meetsEn16931: false, reverseCharge: true }}
        issues={['einvoice_totals_disagree']}
        currency="EUR"
      />,
    );
    expect(screen.getByText('notEn16931')).toBeInTheDocument();
    expect(screen.getByText('totalsDisagree')).toBeInTheDocument();
    expect(screen.getByText('reverseCharge')).toBeInTheDocument();
  });
});
