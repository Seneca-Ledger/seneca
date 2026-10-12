import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, PDFName } from 'pdf-lib';
import { parsePdf } from '@/common/utils/pdf-text.util';
import type { Client } from '@/entities/client.entity';
import type { Invoice } from '@/entities/invoice.entity';
import type { WorkspaceBusinessProfile } from '@/entities/workspace-business-profile.entity';
import { embeddedInvoiceXml, readEInvoice } from '@/modules/e-invoices/einvoice-reader';
import { writeXRechnung, type XRechnungInput } from '@/modules/e-invoices/xrechnung-writer';
import { embedXRechnung, ZUGFERD_FILE_NAME } from '@/modules/e-invoices/zugferd';
import { buildInvoicePdf } from '@/modules/invoices/invoice-document';

const party = {
  street: 'Hauptstraße 1',
  postalCode: '10115',
  city: 'Berlin',
  countryCode: 'DE',
  email: 'rechnung@muster-design.de',
};

const input: XRechnungInput = {
  number: 'INV-2026-0042',
  issueDate: '2026-10-11',
  dueDate: '2026-10-25',
  deliveryDate: '2026-10-10',
  currency: 'EUR',
  buyerReference: 'PO-4711',
  note: null,
  seller: {
    ...party,
    name: 'Muster Design GmbH',
    vatId: 'DE123456789',
    taxNumber: '30/123/45678',
    registrationId: null,
    contactName: 'Erika Muster',
    phone: '+49 30 1234567',
    iban: 'DE02120300000000202051',
    bic: 'BYLADEM1001',
  },
  buyer: { ...party, name: 'Kunde AG', vatId: 'DE987654321', email: 'einkauf@kunde.de' },
  lines: [
    { name: 'Webdesign', quantity: 10, unitCode: 'HUR', net: 950, adjustment: { percent: -5, amount: -50 }, category: 'S', rate: 19, exemptionReason: null },
  ],
};

/** An 8 × 8 PNG with an alpha channel: a logo is where transparency gets into the page. */
const TRANSPARENT_LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAIklEQVR4nGNgqIhiAGIFIHYA4gQgbgDiBUB8AIgfMIwMBQC3IFCBddQWHAAAAABJRU5ErkJggg==';

async function invoicePdf(): Promise<Buffer> {
  return buildInvoicePdf({
    invoice: {
      id: 'invoice-1',
      invoiceNumber: input.number,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      deliveryDate: input.deliveryDate,
      buyerReference: input.buyerReference,
      currency: 'EUR',
      pricesIncludeTax: false,
      subtotal: 950,
      taxTotal: 180.5,
      total: 1130.5,
      notes: null,
    } as Invoice,
    client: { id: 'client-1', name: 'Kunde AG', billingAddress: 'Marktplatz 5\n80331 München', locale: 'de' } as Client,
    profile: {
      workspaceId: 'ws-1',
      legalName: 'Muster Design GmbH',
      taxId: 'DE123456789',
      addressLines: 'Hauptstraße 1\n10115 Berlin',
      countryCode: 'DE',
      bankAccount: 'DE02120300000000202051',
      logoFile: null,
    } as WorkspaceBusinessProfile,
    lines: [
      {
        description: 'Webdesign',
        quantity: 10,
        unitPrice: 100,
        adjustmentPercent: -5,
        taxRatePercent: 19,
        taxRateName: 'USt 19%',
        isReverseCharge: false,
        netAmount: 950,
        taxAmount: 180.5,
        grossAmount: 1130.5,
      },
    ],
    logo: TRANSPARENT_LOGO,
  });
}

describe('embedXRechnung (ZUGFeRD, profile XRECHNUNG)', () => {
  jest.setTimeout(60_000);

  it('carries the XML unchanged, as the alternative representation, with PDF/A-3 metadata', async () => {
    const xml = writeXRechnung(input);
    const pdf = await embedXRechnung(await invoicePdf(), xml, {
      title: `Rechnung ${input.number}`,
      date: new Date('2026-10-11T09:30:00.250Z'),
    });
    const out = process.env.XRECHNUNG_OUT;
    if (out) {
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, 'zugferd.pdf'), pdf);
    }

    expect(await embeddedInvoiceXml(pdf)).toBe(xml);
    expect((await readEInvoice(pdf, 'application/pdf'))?.invoice.number).toBe(input.number);

    const doc = await PDFDocument.load(pdf);
    const af = doc.catalog.lookup(PDFName.of('AF'));
    expect(af?.toString()).toContain('R');
    const files = doc.context
      .enumerateIndirectObjects()
      .map(([, object]) => object.toString())
      .filter(text => text.includes('/Filespec'));
    expect(files).toHaveLength(1);
    expect(files[0]).toContain(`(${ZUGFERD_FILE_NAME})`);
    expect(files[0]).toContain('/AFRelationship /Alternative');
    const text = pdf.toString('latin1');
    expect(text).toContain('<pdfaid:part>3</pdfaid:part>');
    expect(text).toContain('<fx:ConformanceLevel>XRECHNUNG</fx:ConformanceLevel>');
    expect(text).toContain('<xmp:CreateDate>2026-10-11T09:30:00Z</xmp:CreateDate>');
    expect(text).toContain('/OutputIntents');

    // The pages are the same invoice, discount included.
    const pages = String((await parsePdf(pdf)).text).replace(/\s+/g, ' ');
    expect(pages).toContain('INV-2026-0042');
    expect(pages).toContain('Rabatt 5%');
  });
});
