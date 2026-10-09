import type { Client } from '@/entities/client.entity';
import type { Invoice } from '@/entities/invoice.entity';
import type { WorkspaceBusinessProfile } from '@/entities/workspace-business-profile.entity';
import { composeInvoiceEmail } from '@/modules/invoices/invoice-delivery.service';
import { renderInvoiceLabels } from '@/modules/invoices/invoice-document.translations';

const profile = {
  legalName: 'Lumio Software OÜ',
  bankName: 'LHV Pank',
  bankAccount: 'EE471000001020145685',
  bankCode: 'LHVBEE22',
  paymentInstructions: 'Quote the invoice number as the reference.',
  invoiceFooter: 'Thank you for your business.',
} as WorkspaceBusinessProfile;

const invoice = {
  invoiceNumber: 'INV-42',
  dueDate: '2026-03-15',
  currency: 'EUR',
  total: 1200,
} as Invoice;

const client = { name: 'Beta GmbH', locale: 'en' } as Client;

const compose = (overrides: { client?: Client; profile?: WorkspaceBusinessProfile } = {}) => {
  const useClient = overrides.client ?? client;
  return composeInvoiceEmail(
    invoice,
    overrides.profile ?? profile,
    renderInvoiceLabels(useClient.locale),
  );
};

describe('composeInvoiceEmail', () => {
  it('names the invoice and the issuer in the subject', () => {
    expect(compose().subject).toBe('Invoice INV-42 from Lumio Software OÜ');
  });

  it('states what is owed, by when, and how to pay it', () => {
    const { text } = compose();

    expect(text).toContain('Please find invoice INV-42 attached, due on 2026-03-15.');
    expect(text).toContain('Total: 1200.00 EUR');
    expect(text).toContain('Due date: 2026-03-15');
    expect(text).toContain('Bank: LHV Pank');
    expect(text).toContain('Account / IBAN: EE471000001020145685');
    expect(text).toContain('BIC / bank code: LHVBEE22');
    expect(text).toContain('Quote the invoice number as the reference.');
    expect(text).toContain('Thank you for your business.');
  });

  it('leaves out the payment block when there is nothing to say', () => {
    const { text } = compose({ profile: { legalName: 'Solo' } as WorkspaceBusinessProfile });

    expect(text).not.toContain('Payment details');
    expect(text).toContain('Total: 1200.00 EUR');
  });

  it('writes in the client language', () => {
    const { subject, text } = compose({ client: { ...client, locale: 'de' } as Client });

    expect(subject).toBe('Rechnung INV-42 von Lumio Software OÜ');
    expect(text).toContain('Im Anhang finden Sie die Rechnung INV-42, fällig am 2026-03-15.');
    expect(text).toContain('Zahlungsinformationen:');
  });

  it('falls back to English for an unknown locale', () => {
    const { subject } = compose({ client: { ...client, locale: 'xx' } as Client });

    expect(subject).toBe('Invoice INV-42 from Lumio Software OÜ');
  });
});
