import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEInvoiceXml } from '@/modules/e-invoices/einvoice-reader';
import {
  missingForXRechnung,
  vatBreakdownOf,
  writeXRechnung,
  XRECHNUNG_SPECIFICATION,
  type XRechnungInput,
} from '@/modules/e-invoices/xrechnung-writer';

const SELLER: XRechnungInput['seller'] = {
  name: 'Muster Design GmbH',
  street: 'Hauptstraße 1',
  postalCode: '10115',
  city: 'Berlin',
  countryCode: 'DE',
  vatId: 'DE 123456789',
  email: 'rechnung@muster-design.de',
  taxNumber: '30/123/45678',
  registrationId: 'HRB 12345',
  contactName: 'Erika Muster',
  phone: '+49 30 1234567',
  iban: 'DE02 1203 0000 0000 2020 51',
  bic: 'BYLADEM1001',
};

const BUYER: XRechnungInput['buyer'] = {
  name: 'Kunde AG',
  street: 'Marktplatz 5',
  postalCode: '80331',
  city: 'München',
  countryCode: 'DE',
  vatId: 'DE987654321',
  email: 'einkauf@kunde.de',
};

const base = (overrides: Partial<XRechnungInput> = {}): XRechnungInput => ({
  number: 'INV-2026-0001',
  issueDate: '2026-10-11',
  dueDate: '2026-10-25',
  deliveryDate: '2026-10-10',
  currency: 'EUR',
  buyerReference: 'PO-4711',
  note: 'Vielen Dank für Ihren Auftrag.',
  seller: SELLER,
  buyer: BUYER,
  lines: [
    { name: 'Webdesign', quantity: 10, unitCode: 'HUR', net: 950, category: 'S', rate: 19, exemptionReason: null },
  ],
  ...overrides,
});

/** The scenarios the KoSIT validator checks: written out when XRECHNUNG_OUT is set. */
export const SCENARIOS: Record<string, XRechnungInput> = {
  domestic: base(),
  'two-rates': base({
    number: 'INV-2026-0002',
    lines: [
      { name: 'Beratung', quantity: 3, unitCode: 'HUR', net: 333.33, category: 'S', rate: 19, exemptionReason: null },
      { name: 'Fachbuch', quantity: 2, unitCode: 'C62', net: 59.8, category: 'S', rate: 7, exemptionReason: null },
      { name: 'Reisekosten & Spesen <pauschal>', quantity: 1, unitCode: 'C62', net: 120.07, category: 'S', rate: 19, exemptionReason: null },
    ],
  }),
  'reverse-charge': base({
    number: 'INV-2026-0003',
    buyer: { ...BUYER, name: 'Client SARL', street: '1 rue de Rivoli', postalCode: '75001', city: 'Paris', countryCode: 'FR', vatId: 'FR40303265045' },
    lines: [
      { name: 'Software development', quantity: 20, unitCode: 'HUR', net: 1900, category: 'AE', rate: 0, exemptionReason: 'Steuerschuldnerschaft des Leistungsempfängers' },
    ],
  }),
  'small-business': base({
    number: 'INV-2026-0004',
    seller: { ...SELLER, vatId: null },
    lines: [
      { name: 'Fotografie', quantity: 1, unitCode: 'C62', net: 400, category: 'E', rate: 0, exemptionReason: 'Kein Ausweis von Umsatzsteuer, da Kleinunternehmer gemäß § 19 UStG' },
    ],
  }),
  'credit-note': base({
    typeCode: '381',
    number: 'CN-2026-0001',
    dueDate: null,
    precedingInvoice: { number: 'INV-2026-0001', issueDate: '2026-10-11' },
    lines: [
      { name: 'Gutschrift Webdesign', quantity: 2, unitCode: 'HUR', net: 190, category: 'S', rate: 19, exemptionReason: null },
    ],
  }),
  'intra-eu-goods': base({
    number: 'INV-2026-0005',
    buyer: { ...BUYER, name: 'Klant BV', street: 'Damrak 1', postalCode: '1012 LG', city: 'Amsterdam', countryCode: 'NL', vatId: 'NL123456789B01' },
    lines: [
      { name: 'Druckerzeugnisse', quantity: 500, unitCode: 'C62', net: 1250, category: 'K', rate: 0, exemptionReason: 'Innergemeinschaftliche Lieferung' },
    ],
  }),
  'line-adjustments': base({
    number: 'INV-2026-0006',
    lines: [
      { name: 'Webdesign', quantity: 10, unitCode: 'HUR', net: 950, adjustment: { percent: -5, amount: -50 }, category: 'S', rate: 19, exemptionReason: null },
      { name: 'Expresszuschlag Druck', quantity: 3, unitCode: 'C62', net: 36.63, adjustment: { percent: 10, amount: 3.33 }, category: 'S', rate: 7, exemptionReason: null },
    ],
  }),
};

describe('writeXRechnung', () => {
  const out = process.env.XRECHNUNG_OUT;
  if (out) {
    mkdirSync(out, { recursive: true });
  }

  it.each(Object.entries(SCENARIOS))('writes %s so that it reads back the same', (name, input) => {
    const xml = writeXRechnung(input);
    if (out) {
      writeFileSync(join(out, `${name}.xml`), xml);
    }
    const read = parseEInvoiceXml(xml);
    expect(read).toMatchObject({
      syntax: 'cii',
      profile: XRECHNUNG_SPECIFICATION,
      number: input.number,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      deliveryDate: input.deliveryDate,
      currency: 'EUR',
      buyerReference: input.buyerReference,
      iban: input.seller.iban?.replace(/\s+/g, ''),
    });
    expect(read?.seller).toMatchObject({ name: input.seller.name, countryCode: 'DE' });
    expect(read?.buyer).toMatchObject({ name: input.buyer.name, countryCode: input.buyer.countryCode });
    expect(read?.lines.map(line => line.net)).toEqual(input.lines.map(line => line.net));
    expect(read?.lines.map(line => line.unitCode)).toEqual(input.lines.map(line => line.unitCode));
    const net = input.lines.reduce((sum, line) => sum + Math.round(line.net * 100), 0) / 100;
    expect(read?.netTotal).toBe(net);
    expect(read?.payable).toBe(Number(((net * 100 + (read?.taxTotal ?? 0) * 100) / 100).toFixed(2)));
  });

  it('writes a credit note as type 381 that names the invoice it corrects', () => {
    const xml = writeXRechnung(SCENARIOS['credit-note']);
    expect(parseEInvoiceXml(xml)).toMatchObject({ typeCode: '381', isCreditNote: true, payable: 226.1 });
    expect(xml).toContain('<ram:IssuerAssignedID>INV-2026-0001</ram:IssuerAssignedID>');
  });

  it('states a line discount as an allowance and a surcharge as a charge, on the price before it', () => {
    const xml = writeXRechnung(SCENARIOS['line-adjustments']);
    expect(xml).toContain(
      '<ram:ChargeAmount>100</ram:ChargeAmount>',
    );
    expect(xml).toContain(
      '<ram:SpecifiedTradeAllowanceCharge><ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator><ram:CalculationPercent>5</ram:CalculationPercent><ram:BasisAmount>1000.00</ram:BasisAmount><ram:ActualAmount>50.00</ram:ActualAmount><ram:ReasonCode>95</ram:ReasonCode><ram:Reason>Discount</ram:Reason></ram:SpecifiedTradeAllowanceCharge>',
    );
    expect(xml).toContain(
      '<ram:ChargeIndicator><udt:Indicator>true</udt:Indicator></ram:ChargeIndicator><ram:CalculationPercent>10</ram:CalculationPercent><ram:BasisAmount>33.30</ram:BasisAmount><ram:ActualAmount>3.33</ram:ActualAmount><ram:Reason>Surcharge</ram:Reason>',
    );
    expect(xml).toContain('<ram:LineTotalAmount>986.63</ram:LineTotalAmount>');
  });

  it('rounds the VAT once per category, on the summed base (BR-CO-17)', () => {
    const groups = vatBreakdownOf(SCENARIOS['two-rates'].lines);
    // 333.33 + 120.07 = 453.40 at 19 % = 86.146 → 86.15; 59.80 at 7 % = 4.186 → 4.19.
    expect(groups.map(group => [group.category, group.rate, group.baseCents, group.taxCents])).toEqual([
      ['S', 19, 45340, 8615],
      ['S', 7, 5980, 419],
    ]);
  });

  it('escapes what XML would misread', () => {
    const xml = writeXRechnung(SCENARIOS['two-rates']);
    expect(xml).toContain('Reisekosten &amp; Spesen &lt;pauschal&gt;');
  });

  it('lists what is missing instead of writing a broken file', () => {
    const input = base({
      buyerReference: null,
      seller: { ...SELLER, street: null, phone: null, iban: null },
      buyer: { ...BUYER, email: null },
    });
    expect(missingForXRechnung(input)).toEqual([
      'buyer_reference',
      'seller_street',
      'seller_phone',
      'seller_iban',
      'buyer_email',
    ]);
    expect(() => writeXRechnung(input)).toThrow(/buyer_reference/);
  });

  it('needs both VAT ids for a reverse charge', () => {
    const input = { ...SCENARIOS['reverse-charge'], buyer: { ...SCENARIOS['reverse-charge'].buyer, vatId: null } };
    expect(missingForXRechnung(input)).toEqual(['buyer_vat_id']);
  });

  it('needs a VAT id or a tax number from the seller', () => {
    expect(missingForXRechnung(base({ seller: { ...SELLER, vatId: null, taxNumber: null } }))).toEqual([
      'seller_vat_or_tax_number',
    ]);
  });
});
