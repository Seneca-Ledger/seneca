jest.mock('franc', () => ({
  franc: () => 'und',
}));
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { embeddedInvoiceXml, parseEInvoiceXml } from '../../src/modules/e-invoices/einvoice-reader';
import { deleteUserByEmail, e2eTestingModule, registerAccount } from './helpers/e2e-app';

/** Collects a binary response (a PDF) into one Buffer. */
const binaryParser = (response: NodeJS.ReadableStream, callback: (error: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  response.on('data', (chunk: Buffer) => chunks.push(chunk));
  response.on('end', () => callback(null, Buffer.concat(chunks)));
};

/**
 * Issuing an invoice as an XRechnung: what is missing is listed first, and
 * once the profile, the client and the invoice have it, the issued invoice
 * downloads as an XRechnung that reads back with its own figures. Set
 * XRECHNUNG_OUT to keep the files for the KoSIT validator.
 */
describe('Issuing XRechnung (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let workspaceId: string;
  const email = `xrechnung-${Date.now()}@example.com`;

  const api = () => request(app.getHttpServer());
  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`).set('x-workspace-id', workspaceId);

  const rateId = async (code: string) => {
    const rates = await auth(api().get('/tax/settings/rates?date=2026-10-11')).expect(200);
    return (rates.body as Array<{ id: string; code: string }>).find(rate => rate.code === code)?.id;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const account = await registerAccount(app, email, 'XRechnung');
    token = account.token;
    workspaceId = account.workspaceId;
    await auth(api().patch(`/workspaces/${workspaceId}`)).send({ currency: 'EUR' }).expect(200);
    await auth(api().put('/tax/settings/jurisdiction'))
      .send({ code: 'DE', effectiveFrom: '2025-01-01' })
      .expect(200);
  });

  afterAll(async () => {
    try {
      await deleteUserByEmail(dataSource, email);
    } finally {
      await app.close();
    }
  });

  it('lists what is missing, then writes an XRechnung that reads back the same', async () => {
    const client = await auth(api().post('/clients'))
      .send({ name: 'Kunde AG', email: 'einkauf@kunde.de', currency: 'EUR' })
      .expect(201);
    const invoice = await auth(api().post('/invoices'))
      .send({
        clientId: client.body.id,
        issueDate: '2026-10-11',
        dueDate: '2026-10-25',
        currency: 'EUR',
        lineItems: [
          { description: 'Webdesign', quantity: 10, unitPrice: 95, unitCode: 'HUR', taxRateId: await rateId('DE_STANDARD') },
          { description: 'Fachbuch', quantity: 2, unitPrice: 29.9, adjustmentPercent: -5, taxRateId: await rateId('DE_REDUCED') },
        ],
      })
      .expect(201);
    const id = invoice.body.id as string;

    const before = await auth(api().get(`/invoices/${id}/xrechnung/check`)).expect(200);
    expect(before.body.missing).toEqual(
      expect.arrayContaining(['number', 'buyer_reference', 'seller_street', 'seller_iban', 'buyer_street']),
    );
    const refused = await auth(api().get(`/invoices/${id}/xrechnung`)).expect(400);
    expect(JSON.stringify(refused.body)).toContain('XRECHNUNG_INCOMPLETE');

    await auth(api().put('/business-profile'))
      .send({
        legalName: 'Muster Design GmbH',
        addressLines: 'Hauptstraße 1\n10115 Berlin',
        street: 'Hauptstraße 1',
        postalCode: '10115',
        city: 'Berlin',
        countryCode: 'de',
        taxId: 'DE123456789',
        taxNumber: '30/123/45678',
        contactName: 'Erika Muster',
        phone: '+49 30 1234567',
        email: 'rechnung@muster-design.de',
        bankAccount: 'DE02 1203 0000 0000 2020 51',
        bankCode: 'BYLADEM1001',
      })
      .expect(200);
    await auth(api().put(`/clients/${client.body.id}`))
      .send({ street: 'Marktplatz 5', postalCode: '80331', city: 'München', countryCode: 'de', buyerReference: 'PO-4711' })
      .expect(200);
    await auth(api().put(`/invoices/${id}`)).send({ deliveryDate: '2026-10-10' }).expect(200);
    await auth(api().put(`/invoices/${id}/send`)).expect(200);

    const check = await auth(api().get(`/invoices/${id}/xrechnung/check`)).expect(200);
    expect(check.body.missing).toEqual([]);

    const res = await auth(api().get(`/invoices/${id}/xrechnung`)).expect(200);
    expect(res.headers['content-type']).toContain('application/xml');
    const xml = res.text;
    if (process.env.XRECHNUNG_OUT) {
      mkdirSync(process.env.XRECHNUNG_OUT, { recursive: true });
      writeFileSync(join(process.env.XRECHNUNG_OUT, 'e2e-issued.xml'), xml);
    }
    const read = parseEInvoiceXml(xml);
    expect(read).toMatchObject({
      number: expect.any(String),
      issueDate: '2026-10-11',
      dueDate: '2026-10-25',
      deliveryDate: '2026-10-10',
      buyerReference: 'PO-4711',
      currency: 'EUR',
      netTotal: 1006.81,
      iban: 'DE02120300000000202051',
    });
    expect(read?.seller).toMatchObject({ vatId: 'DE123456789', taxNumber: '30/123/45678', countryCode: 'DE' });
    expect(read?.buyer).toMatchObject({ name: 'Kunde AG', countryCode: 'DE' });
    expect(read?.vat.map(item => [item.category, item.rate, item.base, item.tax])).toEqual([
      ['S', 19, 950, 180.5],
      ['S', 7, 56.81, 3.98],
    ]);
    expect(read?.lines.map(line => line.unitCode)).toEqual(['HUR', 'C62']);
    // The 5 % discount on the book: an allowance on 59.80, the invoice's own total.
    expect(xml).toContain('<ram:BasisAmount>59.80</ram:BasisAmount><ram:ActualAmount>2.99</ram:ActualAmount>');
    const sent = await auth(api().get(`/invoices/${id}`)).expect(200);
    expect(Number(sent.body.total)).toBe(read?.payable);

    // The stored PDF is a ZUGFeRD hybrid carrying that very XML, and the XML
    // stays what was issued when the client is edited afterwards.
    const pdf = await auth(api().get(`/invoices/${id}/pdf`))
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    if (process.env.XRECHNUNG_OUT) {
      writeFileSync(join(process.env.XRECHNUNG_OUT, 'e2e-issued.pdf'), pdf.body);
    }
    expect(await embeddedInvoiceXml(pdf.body)).toBe(xml);
    await auth(api().put(`/clients/${client.body.id}`)).send({ buyerReference: 'PO-9999' }).expect(200);
    expect((await auth(api().get(`/invoices/${id}/xrechnung`)).expect(200)).text).toBe(xml);
    await auth(api().put(`/clients/${client.body.id}`)).send({ buyerReference: 'PO-4711' }).expect(200);

    // A credit for the whole invoice: an XRechnung of type 381 naming it.
    const note = await auth(api().post('/credit-notes'))
      .send({ issueDate: '2026-10-20', reason: 'Projekt storniert', applications: [{ invoiceId: id }] })
      .expect(201);
    const credit = await auth(api().get(`/credit-notes/${note.body.id}/xrechnung`)).expect(200);
    if (process.env.XRECHNUNG_OUT) {
      writeFileSync(join(process.env.XRECHNUNG_OUT, 'e2e-credit-note.xml'), credit.text);
    }
    const creditRead = parseEInvoiceXml(credit.text);
    expect(creditRead).toMatchObject({
      typeCode: '381',
      isCreditNote: true,
      issueDate: '2026-10-20',
      buyerReference: 'PO-4711',
    });
    expect(creditRead?.payable).toBe(read?.payable);
    expect(credit.text).toContain(`<ram:IssuerAssignedID>${read?.number}</ram:IssuerAssignedID>`);
    const creditPdf = await auth(api().get(`/credit-notes/${note.body.id}/pdf`))
      .buffer(true)
      .parse(binaryParser)
      .expect(200);
    if (process.env.XRECHNUNG_OUT) {
      writeFileSync(join(process.env.XRECHNUNG_OUT, 'e2e-credit-note.pdf'), creditPdf.body);
    }
    expect(parseEInvoiceXml((await embeddedInvoiceXml(creditPdf.body)) ?? '')).toMatchObject({
      typeCode: '381',
      number: creditRead?.number,
    });
  });

  it('writes a reverse-charged service to an EU business as category AE', async () => {
    const client = await auth(api().post('/clients'))
      .send({
        name: 'Client SARL',
        email: 'compta@client.fr',
        taxId: 'FR40303265045',
        street: '1 rue de Rivoli',
        postalCode: '75001',
        city: 'Paris',
        countryCode: 'FR',
        buyerReference: 'BC-2026-17',
        currency: 'EUR',
      })
      .expect(201);
    const invoice = await auth(api().post('/invoices'))
      .send({
        clientId: client.body.id,
        issueDate: '2026-10-11',
        dueDate: '2026-11-10',
        currency: 'EUR',
        lineItems: [
          { description: 'Software development', quantity: 20, unitPrice: 95, unitCode: 'HUR', taxRateId: await rateId('DE_STANDARD_RC') },
        ],
      })
      .expect(201);
    await auth(api().put(`/invoices/${invoice.body.id}/send`)).expect(200);

    const res = await auth(api().get(`/invoices/${invoice.body.id}/xrechnung`)).expect(200);
    if (process.env.XRECHNUNG_OUT) {
      writeFileSync(join(process.env.XRECHNUNG_OUT, 'e2e-reverse-charge.xml'), res.text);
    }
    const read = parseEInvoiceXml(res.text);
    expect(read?.vat).toEqual([
      expect.objectContaining({ category: 'AE', rate: 0, base: 1900, tax: 0 }),
    ]);
    expect(read?.payable).toBe(1900);
  });

  it('refuses a line without a VAT rate for a VAT-registered business', async () => {
    const client = await auth(api().post('/clients'))
      .send({ name: 'No Rate GmbH', email: 'a@b.de', street: 'Weg 1', postalCode: '10115', city: 'Berlin', countryCode: 'DE', buyerReference: 'X', currency: 'EUR' })
      .expect(201);
    const invoice = await auth(api().post('/invoices'))
      .send({ clientId: client.body.id, issueDate: '2026-10-11', currency: 'EUR', lineItems: [{ description: 'Work', quantity: 1, unitPrice: 100 }] })
      .expect(201);
    await auth(api().put(`/invoices/${invoice.body.id}/send`)).expect(200);
    const check = await auth(api().get(`/invoices/${invoice.body.id}/xrechnung/check`)).expect(200);
    expect(check.body.missing).toEqual(['line_tax_rate']);
  });
});
