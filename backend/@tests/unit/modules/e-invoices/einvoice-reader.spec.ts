import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  embeddedInvoiceXml,
  parseEInvoiceXml,
  readEInvoice,
} from '@/modules/e-invoices/einvoice-reader';

const FIXTURES = join(__dirname, '../../../fixtures/e-invoices');
const xrechnung = (name: string) => readFileSync(join(FIXTURES, 'xrechnung', name), 'utf8');
const zugferd = (name: string) => readFileSync(join(FIXTURES, 'zugferd', name));

/** Where the test suite's two files of one case really differ (checked by hand). */
const KNOWN_DIFFERENCES: Record<
  string,
  { ubl?: Record<string, unknown>; cii?: Record<string, unknown> }
> = {
  '01.21a-INVOICE': {
    ubl: { sellerVatId: 'DE 123456789' },
    cii: { sellerVatId: 'DE152338654' },
  },
};

const CASES = readdirSync(join(FIXTURES, 'xrechnung'))
  .filter(name => name.endsWith('_ubl.xml'))
  .map(name => name.replace('_ubl.xml', ''));

describe('parseEInvoiceXml', () => {
  it('reads an XRechnung in UBL', () => {
    const invoice = parseEInvoiceXml(xrechnung('01.01a-INVOICE_ubl.xml'));
    expect(invoice).toMatchObject({
      syntax: 'ubl',
      profile: 'urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0',
      meetsEn16931: true,
      isCreditNote: false,
      number: '123456XX',
      issueDate: '2016-04-04',
      currency: 'EUR',
      netTotal: 314.86,
      taxTotal: 22.04,
      grossTotal: 336.9,
      payable: 336.9,
      iban: 'DE79000000001234567890',
    });
    expect(invoice?.seller).toMatchObject({ vatId: 'DE 123456789', countryCode: 'DE' });
    expect(invoice?.vat).toEqual([
      expect.objectContaining({ category: 'S', rate: 7, tax: 22.04 }),
    ]);
  });

  it.each(CASES)('reads %s the same from UBL and from CII', name => {
    const ubl = parseEInvoiceXml(xrechnung(`${name}_ubl.xml`));
    const cii = parseEInvoiceXml(xrechnung(`${name}_uncefact.xml`));
    expect(ubl?.syntax).toBe('ubl');
    expect(cii?.syntax).toBe('cii');
    const comparable = (invoice: typeof ubl) => ({
      number: invoice?.number,
      issueDate: invoice?.issueDate,
      dueDate: invoice?.dueDate,
      currency: invoice?.currency,
      netTotal: invoice?.netTotal,
      taxTotal: invoice?.taxTotal,
      grossTotal: invoice?.grossTotal,
      payable: invoice?.payable,
      sellerName: invoice?.seller.name,
      sellerVatId: invoice?.seller.vatId,
      sellerCountry: invoice?.seller.countryCode,
      buyerCountry: invoice?.buyer.countryCode,
      iban: invoice?.iban,
      vat: invoice?.vat.map(item => [item.category, item.rate, item.base, item.tax]),
      lines: invoice?.lines.length,
      lineNet: invoice?.lines.map(line => line.net),
    });
    const known = KNOWN_DIFFERENCES[name] ?? {};
    expect({ ...comparable(cii), ...known.cii }).toEqual({ ...comparable(ubl), ...known.cii });
    for (const [field, value] of Object.entries(known.cii ?? {})) {
      expect(comparable(cii)[field as keyof ReturnType<typeof comparable>]).toEqual(value);
      expect(comparable(ubl)[field as keyof ReturnType<typeof comparable>]).toEqual(
        known.ubl?.[field],
      );
    }
    // Every sample is a complete invoice.
    expect(ubl?.number).toBeTruthy();
    expect(ubl?.payable).not.toBeNull();
  });

  it('answers NULL for XML that is not an invoice, and for broken XML', () => {
    expect(parseEInvoiceXml('<Document><BkToCstmrStmt/></Document>')).toBeNull();
    expect(parseEInvoiceXml('<Invoice><ID>1</ID')).toBeNull();
  });

  it('does not expand entities', () => {
    const xml = `<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e "EXPANDED">]>
      <Invoice><ID>&e;</ID></Invoice>`;
    expect(parseEInvoiceXml(xml)?.number).not.toBe('EXPANDED');
  });
});

describe('hybrid PDFs (ZUGFeRD / Factur-X)', () => {
  it('finds the embedded factur-x.xml and reads it', async () => {
    const result = await readEInvoice(zugferd('EN16931_Einfach.pdf'), 'application/pdf');
    expect(result?.invoice).toMatchObject({ syntax: 'cii', meetsEn16931: true });
    expect(result?.invoice.payable).toBeGreaterThan(0);
    expect(result?.invoice.seller.vatId).toBeTruthy();
  });

  it('finds an embedded xrechnung.xml', async () => {
    expect(await embeddedInvoiceXml(zugferd('XRECHNUNG_Einfach.pdf'))).toContain(
      'CrossIndustryInvoice',
    );
  });

  it('reads an intra-Community supply as category K', async () => {
    const result = await readEInvoice(
      zugferd('EN16931_Innergemeinschaftliche_Lieferungen.pdf'),
      'application/pdf',
    );
    expect(result?.invoice.vat.map(item => item.category)).toContain('K');
    expect(result?.invoice.buyer.vatId).toBeTruthy();
  });

  it('reads a German "Gutschrift" as what it is: a self-billed invoice, not a credit note', async () => {
    const result = await readEInvoice(zugferd('EN16931_Gutschrift.pdf'), 'application/pdf');
    expect(result?.invoice).toMatchObject({ typeCode: '389', isCreditNote: false });
  });

  it('marks a MINIMUM profile as not an e-invoice', async () => {
    const result = await readEInvoice(zugferd('Facture_DOM_MINIMUM.pdf'), 'application/pdf');
    expect(result?.invoice.meetsEn16931).toBe(false);
  });

  it('answers NULL for a PDF without an invoice, an image, and a plain text file', async () => {
    expect(await readEInvoice(Buffer.from('%PDF-1.4 broken'), 'application/pdf')).toBeNull();
    expect(await readEInvoice(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg')).toBeNull();
    expect(await readEInvoice(Buffer.from('just text'), 'text/plain')).toBeNull();
  });

  it('reads a raw XML upload', async () => {
    const result = await readEInvoice(
      Buffer.from(xrechnung('01.01a-INVOICE_uncefact.xml')),
      'application/xml',
      'invoice.xml',
    );
    expect(result?.invoice.number).toBe('123456XX');
  });
});
