import pdfParse from 'pdf-parse';
import type { Client } from '@/entities/client.entity';
import type { Invoice } from '@/entities/invoice.entity';
import type { WorkspaceBusinessProfile } from '@/entities/workspace-business-profile.entity';
import {
  buildInvoicePdf,
  type InvoiceDocumentInput,
  type InvoiceDocumentLine,
} from '@/modules/invoices/invoice-document';

const profile = {
  workspaceId: 'ws-1',
  legalName: 'Lumio Software OÜ',
  registrationId: '16123456',
  taxId: 'EE102345678',
  addressLines: 'Tartu mnt 67\n10115 Tallinn',
  countryCode: 'EE',
  email: 'billing@lumio.test',
  phone: '+372 5555 0100',
  website: 'lumio.test',
  bankName: 'LHV Pank',
  bankAccount: 'EE471000001020145685',
  bankCode: 'LHVBEE22',
  paymentInstructions: 'Please quote the invoice number as the payment reference.',
  invoiceFooter: 'Thank you for your business.',
  logoFile: null,
} as WorkspaceBusinessProfile;

const client = {
  id: 'client-1',
  name: 'Beta GmbH',
  billingAddress: 'Hauptstrasse 1\n10115 Berlin',
  taxId: 'DE123456789',
  locale: 'en',
} as Client;

const invoice = {
  id: 'invoice-1',
  invoiceNumber: 'INV-42',
  issueDate: '2026-03-01',
  dueDate: '2026-03-15',
  currency: 'EUR',
  pricesIncludeTax: false,
  subtotal: 1000,
  taxTotal: 200,
  total: 1200,
  notes: 'Milestone 2 of the integration project.',
} as Invoice;

const line = (overrides: Partial<InvoiceDocumentLine> = {}): InvoiceDocumentLine => ({
  description: 'Integration work',
  quantity: 10,
  unitPrice: 100,
  taxRatePercent: 20,
  taxRateName: 'VAT 20%',
  isReverseCharge: false,
  netAmount: 1000,
  taxAmount: 200,
  grossAmount: 1200,
  ...overrides,
});

async function textOf(input: Partial<InvoiceDocumentInput> = {}): Promise<string> {
  const pdf = await buildInvoicePdf({
    invoice,
    client,
    profile,
    lines: [line()],
    logo: null,
    ...input,
  });
  // pdf-parse takes the bytes directly, so the document never has to be
  // written to disk. Whitespace is normalised because pdfmake breaks a column
  // into separate text runs.
  const parsed = await pdfParse(pdf);
  return String(parsed.text).replace(/\s+/g, ' ');
}

describe('buildInvoicePdf', () => {
  jest.setTimeout(60_000);

  it('prints who is billing: name, address, tax ids and contacts', async () => {
    const text = await textOf();

    expect(text).toContain('Lumio Software OÜ');
    expect(text).toContain('Tartu mnt 67');
    expect(text).toContain('10115 Tallinn');
    expect(text).toContain('16123456');
    expect(text).toContain('EE102345678');
    expect(text).toContain('billing@lumio.test');
  });

  it('prints how to pay it', async () => {
    const text = await textOf();

    expect(text).toContain('Payment details');
    expect(text).toContain('LHV Pank');
    expect(text).toContain('EE471000001020145685');
    expect(text).toContain('LHVBEE22');
    expect(text).toContain('Please quote the invoice number');
    expect(text).toContain('Thank you for your business.');
  });

  it('prints the client, the dates and the number', async () => {
    const text = await textOf();

    expect(text).toContain('Beta GmbH');
    expect(text).toContain('Hauptstrasse 1');
    expect(text).toContain('INV-42');
    expect(text).toContain('2026-03-01');
    expect(text).toContain('2026-03-15');
  });

  it('breaks the tax down per rate', async () => {
    const text = await textOf({
      lines: [
        line(),
        line({
          description: 'Hosting',
          quantity: 1,
          unitPrice: 200,
          taxRatePercent: 9,
          taxRateName: 'VAT 9%',
          netAmount: 200,
          taxAmount: 18,
          grossAmount: 218,
        }),
      ],
    });

    expect(text).toContain('Tax 20%');
    expect(text).toContain('Tax 9%');
    expect(text).toContain('1200.00 EUR');
  });

  it('says so on a reverse-charged supply, and charges no tax', async () => {
    const text = await textOf({
      lines: [line({ isReverseCharge: true, taxAmount: 0, grossAmount: 1000 })],
    });

    expect(text).toContain('Reverse charge');
    expect(text).toMatch(/0%/);
  });

  it('notes when the prices already contain the tax', async () => {
    const text = await textOf({
      invoice: { ...invoice, pricesIncludeTax: true } as Invoice,
    });

    expect(text).toContain('Prices include tax');
  });

  it('follows the client locale', async () => {
    const text = await textOf({ client: { ...client, locale: 'de' } as Client });

    expect(text).toContain('Rechnung');
    expect(text).toContain('Rechnungsempfänger');
    expect(text).toContain('Zahlungsinformationen');
    expect(text).not.toContain('Payment details');
  });

  it('falls back to English for a locale it has no labels for', async () => {
    const text = await textOf({ client: { ...client, locale: 'xx-XX' } as Client });

    expect(text).toContain('Invoice');
    expect(text).toContain('Bill to');
  });

  it('stamps a draft and leaves out an empty payment block', async () => {
    const bare = { workspaceId: 'ws-1', legalName: 'Solo Trader', addressLines: 'Main st 1' };
    const text = await textOf({ profile: bare as WorkspaceBusinessProfile, draft: true });

    expect(text).toContain('DRAFT');
    expect(text).not.toContain('Payment details');
    expect(text).toContain('Solo Trader');
  });
});
