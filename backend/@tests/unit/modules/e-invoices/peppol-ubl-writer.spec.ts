import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEInvoiceXml } from '@/modules/e-invoices/einvoice-reader';
import { parsePeppolId, suggestPeppolId } from '@/modules/e-invoices/peppol-id';
import {
  missingForPeppol,
  PEPPOL_BIS_CUSTOMIZATION,
  writePeppolUbl,
} from '@/modules/e-invoices/peppol-ubl-writer';
import { writeXRechnung, type XRechnungInput } from '@/modules/e-invoices/xrechnung-writer';

const BE_SELLER: XRechnungInput['seller'] = {
  name: 'Atelier Lumière BV',
  street: 'Grote Markt 1',
  postalCode: '1000',
  city: 'Brussel',
  countryCode: 'BE',
  vatId: 'BE0123456749',
  email: 'factuur@atelier.be',
  peppolId: '0208:0123456749',
  taxNumber: null,
  registrationId: null,
  contactName: null,
  phone: null,
  iban: 'BE68 5390 0754 7034',
  bic: null,
};

const BE_BUYER: XRechnungInput['buyer'] = {
  name: 'Klant NV',
  street: 'Meir 10',
  postalCode: '2000',
  city: 'Antwerpen',
  countryCode: 'BE',
  vatId: 'BE0428643097',
  email: null,
  peppolId: '0208:0428643097',
};

const DE_SELLER: XRechnungInput['seller'] = {
  name: 'Muster Design GmbH',
  street: 'Hauptstraße 1',
  postalCode: '10115',
  city: 'Berlin',
  countryCode: 'DE',
  vatId: 'DE123456789',
  email: 'rechnung@muster-design.de',
  peppolId: '9930:DE123456789',
  taxNumber: '30/123/45678',
  registrationId: 'HRB 12345',
  contactName: 'Erika Muster',
  phone: '+49 30 1234567',
  iban: 'DE02 1203 0000 0000 2020 51',
  bic: 'BYLADEM1001',
};

const base = (overrides: Partial<XRechnungInput> = {}): XRechnungInput => ({
  number: 'F-2026-0001',
  issueDate: '2026-10-13',
  dueDate: '2026-11-12',
  deliveryDate: '2026-10-10',
  currency: 'EUR',
  buyerReference: 'PO-4711',
  note: null,
  seller: BE_SELLER,
  buyer: BE_BUYER,
  lines: [
    { name: 'Webdesign', quantity: 10, unitCode: 'HUR', net: 950, category: 'S', rate: 21, exemptionReason: null },
  ],
  ...overrides,
});

/** The scenarios the Peppol validation artefacts check: written out when PEPPOL_OUT is set. */
const SCENARIOS: Record<string, XRechnungInput> = {
  'be-domestic': base(),
  'be-two-rates-adjusted': base({
    number: 'F-2026-0002',
    lines: [
      { name: 'Webdesign', quantity: 10, unitCode: 'HUR', net: 950, adjustment: { percent: -5, amount: -50 }, category: 'S', rate: 21, exemptionReason: null },
      { name: 'Boek', quantity: 3, unitCode: 'C62', net: 36.63, adjustment: { percent: 10, amount: 3.33 }, category: 'S', rate: 6, exemptionReason: null },
    ],
  }),
  'de-to-be-reverse-charge': base({
    number: 'INV-2026-0007',
    seller: DE_SELLER,
    lines: [
      { name: 'Software development', quantity: 20, unitCode: 'HUR', net: 1900, category: 'AE', rate: 0, exemptionReason: 'Reverse charge' },
    ],
  }),
  'de-to-be-goods': base({
    number: 'INV-2026-0008',
    seller: DE_SELLER,
    lines: [
      { name: 'Druckerzeugnisse', quantity: 500, unitCode: 'C62', net: 1250, category: 'K', rate: 0, exemptionReason: 'Intra-community supply' },
    ],
  }),
  'be-credit-note': base({
    typeCode: '381',
    number: 'CN-2026-0001',
    dueDate: null,
    precedingInvoice: { number: 'F-2026-0001', issueDate: '2026-10-13' },
    lines: [
      { name: 'Webdesign', quantity: 2, unitCode: 'HUR', net: 190, category: 'S', rate: 21, exemptionReason: null },
    ],
  }),
  'be-no-iban': base({ number: 'F-2026-0003', seller: { ...BE_SELLER, iban: null } }),
};

describe('writePeppolUbl', () => {
  const out = process.env.PEPPOL_OUT;
  if (out) {
    mkdirSync(out, { recursive: true });
  }

  it.each(Object.entries(SCENARIOS))('writes %s so that it reads back the same', (name, input) => {
    const xml = writePeppolUbl(input);
    if (out) {
      writeFileSync(join(out, `${name}.xml`), xml);
    }
    const read = parseEInvoiceXml(xml);
    expect(read).toMatchObject({
      syntax: 'ubl',
      profile: PEPPOL_BIS_CUSTOMIZATION,
      number: input.number,
      issueDate: input.issueDate,
      currency: 'EUR',
      buyerReference: input.buyerReference,
      isCreditNote: input.typeCode === '381',
    });
    expect(read?.seller).toMatchObject({ name: input.seller.name, countryCode: input.seller.countryCode });
    expect(read?.buyer).toMatchObject({ name: input.buyer.name, countryCode: 'BE' });
    expect(read?.lines.map(line => line.net)).toEqual(input.lines.map(line => line.net));
    // The same figures as the XRechnung of the same input, where that can be written.
    if (input.seller.countryCode === 'DE') {
      const cii = parseEInvoiceXml(writeXRechnung({ ...input, buyer: { ...input.buyer, email: 'x@klant.be' } }));
      expect(read?.payable).toBe(cii?.payable);
      expect(read?.taxTotal).toBe(cii?.taxTotal);
    }
  });

  it('addresses both parties by their Peppol id', () => {
    const xml = writePeppolUbl(SCENARIOS['be-domestic']);
    expect(xml).toContain('<cbc:EndpointID schemeID="0208">0123456749</cbc:EndpointID>');
    expect(xml).toContain('<cbc:EndpointID schemeID="0208">0428643097</cbc:EndpointID>');
  });

  it('writes a credit note as a UBL CreditNote naming the invoice it corrects', () => {
    const xml = writePeppolUbl(SCENARIOS['be-credit-note']);
    expect(xml).toContain('<CreditNote xmlns="urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2"');
    expect(xml).toContain('<cbc:CreditedQuantity unitCode="HUR">2</cbc:CreditedQuantity>');
    expect(xml).toContain('<cac:InvoiceDocumentReference><cbc:ID>F-2026-0001</cbc:ID>');
    expect(xml).not.toContain('<cbc:DueDate>');
  });

  it('names no payment means without an IBAN, and does not need the XRechnung extras', () => {
    const input = SCENARIOS['be-no-iban'];
    expect(missingForPeppol(input)).toEqual([]);
    expect(writePeppolUbl(input)).not.toContain('PaymentMeans');
  });

  it('lists what is missing instead of writing a broken file', () => {
    const input = base({
      buyerReference: null,
      buyer: { ...BE_BUYER, peppolId: null },
      seller: { ...BE_SELLER, peppolId: 'not an id' },
    });
    expect(missingForPeppol(input)).toEqual(['buyer_reference', 'seller_peppol_id', 'buyer_peppol_id']);
    expect(() => writePeppolUbl(input)).toThrow('buyer_reference');
  });
});

describe('Peppol ids', () => {
  it('reads scheme:value and nothing else', () => {
    expect(parsePeppolId(' 0208 : 0428643097 ')).toEqual({ scheme: '0208', value: '0428643097' });
    expect(parsePeppolId('BE0428643097')).toBeNull();
    expect(parsePeppolId(null)).toBeNull();
  });

  it('suggests the scheme a VAT id is usually registered under', () => {
    expect(suggestPeppolId('DE 123 456 789')).toBe('9930:DE123456789');
    expect(suggestPeppolId('BE 0428.643.097')).toBe('0208:0428643097');
    expect(suggestPeppolId('ATU12345678')).toBe('9914:ATU12345678');
    expect(suggestPeppolId('PL1234567890')).toBeNull();
  });
});
