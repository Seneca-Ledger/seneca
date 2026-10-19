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
import { parseEInvoiceXml } from '../../src/modules/e-invoices/einvoice-reader';
import { PEPPOL_DOCTYPES, writePeppolUbl } from '../../src/modules/e-invoices/peppol-ubl-writer';
import { RECOMMAND_API_URL } from '../../src/modules/peppol/recommand.client';
import { deleteUserByEmail, e2eTestingModule, registerAccount } from './helpers/e2e-app';

/**
 * Peppol through the workspace's own Recommand account. Recommand is played
 * by a fake `fetch`: it records what Seneca sends and answers as the API
 * documents (https://docs.recommand.eu). Everything else on the way — the
 * invoice, the writers, the database rows, the receipt pipeline — is real.
 */
describe('Peppol via Recommand (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let workspaceId: string;
  const email = `peppol-${Date.now()}@example.com`;
  const realFetch = globalThis.fetch;

  /** What the fake access point knows: who is registered for which document types. */
  const registry = new Map<string, string[]>();
  const sent: Array<{ companyId: string; body: Record<string, unknown>; authorization: string }> = [];
  const inbox: Array<{ id: string; type: string; senderId: string; xml?: string }> = [];
  const readIds: string[] = [];
  let deliveryStatus = 'pending';

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  function recommand(url: URL, init: RequestInit | undefined, authorization: string): Response {
    if (authorization !== `Basic ${Buffer.from('key_test:secret_test').toString('base64')}`) {
      return json({ success: false, errors: { auth: ['Unauthorized'] } }, 401);
    }
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url.pathname === '/api/core/auth/verify') {
      return json({ success: true });
    }
    if (url.pathname === '/api/v1/companies') {
      return json({
        success: true,
        companies: [
          {
            id: 'c_muster',
            name: 'Muster Design GmbH',
            country: 'DE',
            vatNumber: 'DE123456789',
            enterpriseNumber: 'DE123456789',
            enterpriseNumberScheme: '9930',
            isVerified: true,
          },
        ],
      });
    }
    if (url.pathname === '/api/v1/verify') {
      const docTypes = registry.get(body.peppolAddress);
      return json(
        docTypes
          ? {
              success: true,
              isValid: true,
              companyName: 'Registered BV',
              supportedDocuments: docTypes.map(docTypeId => ({ docTypeId, name: 'doc' })),
            }
          : { success: true, isValid: false },
      );
    }
    const send = /^\/api\/v1\/([^/]+)\/send$/.exec(url.pathname);
    if (send) {
      sent.push({ companyId: send[1], body, authorization });
      // PEPPOL_OUT keeps what was sent for the Peppol and KoSIT validators.
      if (process.env.PEPPOL_OUT) {
        mkdirSync(process.env.PEPPOL_OUT, { recursive: true });
        writeFileSync(join(process.env.PEPPOL_OUT, `e2e-sent-${sent.length}.xml`), String(body.document));
      }
      return json({
        success: true,
        id: `doc_out_${sent.length}`,
        deliveryStatus: 'pending',
        deliveries: [{ channel: 'peppol', status: 'pending', failure: null }],
      });
    }
    if (url.pathname === '/api/v1/inbox') {
      return json({
        success: true,
        documents: inbox
          .filter(item => !readIds.includes(item.id))
          .map(({ id, type, senderId }) => ({ id, type, senderId, docTypeId: 'x' })),
      });
    }
    const read = /^\/api\/v1\/documents\/([^/]+)\/mark-as-read$/.exec(url.pathname);
    if (read) {
      readIds.push(read[1]);
      return json({ success: true });
    }
    const documentId = /^\/api\/v1\/documents\/([^/]+)$/.exec(url.pathname)?.[1];
    if (documentId?.startsWith('doc_out_')) {
      return json({
        success: true,
        document: {
          id: documentId,
          type: 'invoice',
          deliveryStatus,
          deliveries: [
            {
              channel: 'peppol',
              status: deliveryStatus,
              failure: deliveryStatus === 'failed' ? { message: 'Receiver rejected' } : null,
            },
          ],
        },
      });
    }
    const incoming = inbox.find(item => item.id === documentId);
    if (incoming) {
      return json({ success: true, document: { ...incoming, deliveryStatus: null } });
    }
    return json({ success: false, errors: { path: ['Not found'] } }, 404);
  }

  const api = () => request(app.getHttpServer());
  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`).set('x-workspace-id', workspaceId);
  const rateId = async (code: string) => {
    const rates = await auth(api().get('/tax/settings/rates?date=2026-10-13')).expect(200);
    return (rates.body as Array<{ id: string; code: string }>).find(rate => rate.code === code)?.id;
  };
  const sentInvoice = async (clientId: string) => {
    const invoice = await auth(api().post('/invoices'))
      .send({
        clientId,
        issueDate: '2026-10-13',
        dueDate: '2026-10-27',
        currency: 'EUR',
        buyerReference: 'PO-4711',
        deliveryDate: '2026-10-10',
        lineItems: [
          {
            description: 'Software development',
            quantity: 20,
            unitPrice: 95,
            unitCode: 'HUR',
            taxRateId: await rateId('DE_STANDARD_RC'),
          },
        ],
      })
      .expect(201);
    await auth(api().put(`/invoices/${invoice.body.id}/send`)).expect(200);
    return invoice.body.id as string;
  };

  beforeAll(async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = new URL(String(input instanceof Request ? input.url : input));
      if (url.origin !== RECOMMAND_API_URL) {
        return realFetch(input, init);
      }
      const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
      const body = input instanceof Request ? await input.text() : init?.body;
      return recommand(url, { ...init, body: body as BodyInit }, headers.get('authorization') ?? '');
    });

    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const account = await registerAccount(app, email, 'Peppol');
    token = account.token;
    workspaceId = account.workspaceId;
    await auth(api().patch(`/workspaces/${workspaceId}`)).send({ currency: 'EUR' }).expect(200);
    await auth(api().put('/tax/settings/jurisdiction'))
      .send({ code: 'DE', effectiveFrom: '2025-01-01' })
      .expect(200);
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
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    try {
      await deleteUserByEmail(dataSource, email);
    } finally {
      await app.close();
    }
  });

  it('connects with a key and secret it checked, and never hands the secret back', async () => {
    const before = await auth(api().get('/integrations/peppol/status')).expect(200);
    expect(before.body).toMatchObject({ connected: false });

    const refused = await auth(api().post('/integrations/peppol/settings'))
      .send({ apiKeyId: 'key_test', apiSecret: 'wrong' })
      .expect(400);
    expect(refused.body.error?.code ?? refused.body.code).toBe('PEPPOL_AUTH_FAILED');

    const connected = await auth(api().post('/integrations/peppol/settings'))
      .send({ apiKeyId: 'key_test', apiSecret: 'secret_test' })
      .expect(201);
    expect(connected.body).toMatchObject({
      connected: true,
      settings: { companyId: 'c_muster', senderPeppolId: '9930:DE123456789' },
    });
    expect(JSON.stringify(connected.body)).not.toContain('secret_test');
    const [row] = await dataSource.query(
      `SELECT api_secret FROM peppol_connections WHERE workspace_id = $1`,
      [workspaceId],
    );
    expect(row.api_secret).not.toContain('secret_test');

    // A blank secret keeps the stored one.
    await auth(api().post('/integrations/peppol/settings'))
      .send({ apiKeyId: 'key_test', senderPeppolId: '9930:DE123456789' })
      .expect(201);
  });

  it('sends Peppol BIS to a recipient that registered only BIS, and only once', async () => {
    registry.set('0208:0428643097', [PEPPOL_DOCTYPES.bisInvoice, PEPPOL_DOCTYPES.bisCreditNote]);
    const client = await auth(api().post('/clients'))
      .send({
        name: 'Klant NV',
        currency: 'EUR',
        taxId: 'BE0428643097',
        street: 'Meir 10',
        postalCode: '2000',
        city: 'Antwerpen',
        countryCode: 'BE',
        supplyType: 'services',
        peppolId: ' 0208 : 0428643097 ',
      })
      .expect(201);
    expect(client.body.peppolId).toBe('0208:0428643097');
    const invoiceId = await sentInvoice(client.body.id);

    const result = await auth(api().post(`/invoices/${invoiceId}/peppol`)).expect(201);
    expect(result.body).toMatchObject({
      recipient: '0208:0428643097',
      format: 'peppol_bis',
      status: 'pending',
    });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      companyId: 'c_muster',
      body: { recipient: '0208:0428643097', documentType: 'xml', doctypeId: PEPPOL_DOCTYPES.bisInvoice },
    });
    const xml = String(sent[0].body.document);
    expect(xml).toContain('<cbc:EndpointID schemeID="9930">DE123456789</cbc:EndpointID>');
    expect(xml).toContain('<cbc:EndpointID schemeID="0208">0428643097</cbc:EndpointID>');
    expect(parseEInvoiceXml(xml)).toMatchObject({ syntax: 'ubl', netTotal: 1900, taxTotal: 0 });

    // The XML exactly as sent is kept.
    const kept = await auth(api().get(`/peppol/transmissions/${result.body.id}/document`)).expect(200);
    expect(kept.text).toBe(xml);

    const again = await auth(api().post(`/invoices/${invoiceId}/peppol`)).expect(409);
    expect(JSON.stringify(again.body)).toContain('PEPPOL_ALREADY_SENT');
    expect(sent).toHaveLength(1);

    // Delivery is confirmed later; reading the log asks again.
    deliveryStatus = 'delivered';
    const log = await auth(api().get(`/invoices/${invoiceId}/peppol`)).expect(200);
    expect(log.body).toEqual([expect.objectContaining({ status: 'delivered', failure: null })]);
  });

  it('sends the XRechnung (CII) to a German recipient that takes it', async () => {
    registry.set('9930:DE987654321', [PEPPOL_DOCTYPES.xrechnungCii, PEPPOL_DOCTYPES.bisInvoice]);
    const client = await auth(api().post('/clients'))
      .send({
        name: 'Kunde AG',
        currency: 'EUR',
        taxId: 'DE987654321',
        street: 'Marktplatz 5',
        postalCode: '80331',
        city: 'München',
        countryCode: 'DE',
        peppolId: '9930:DE987654321',
      })
      .expect(201);
    const invoice = await auth(api().post('/invoices'))
      .send({
        clientId: client.body.id,
        issueDate: '2026-10-13',
        currency: 'EUR',
        buyerReference: 'PO-1',
        lineItems: [{ description: 'Webdesign', quantity: 1, unitPrice: 500, taxRateId: await rateId('DE_STANDARD') }],
      })
      .expect(201);
    await auth(api().put(`/invoices/${invoice.body.id}/send`)).expect(200);

    const result = await auth(api().post(`/invoices/${invoice.body.id}/peppol`)).expect(201);
    expect(result.body.format).toBe('xrechnung_cii');
    const last = sent[sent.length - 1];
    expect(last.body.doctypeId).toBe(PEPPOL_DOCTYPES.xrechnungCii);
    expect(String(last.body.document)).toContain('<ram:URIID schemeID="9930">DE987654321</ram:URIID>');
  });

  it('refuses before sending: an unknown recipient, a draft, a Leitweg-ID that is not the buyer reference', async () => {
    const unknown = await auth(api().post('/clients'))
      .send({ name: 'Nobody', currency: 'EUR', countryCode: 'BE', peppolId: '0208:0123456749' })
      .expect(201);
    const before = sent.length;
    const invoiceId = await sentInvoice(unknown.body.id);
    const notThere = await auth(api().post(`/invoices/${invoiceId}/peppol`)).expect(400);
    expect(JSON.stringify(notThere.body)).toContain('PEPPOL_RECIPIENT_UNKNOWN');

    const authority = await auth(api().post('/clients'))
      .send({ name: 'Bundesamt', currency: 'EUR', countryCode: 'DE', peppolId: '0204:991-12345-67' })
      .expect(201);
    registry.set('0204:991-12345-67', [PEPPOL_DOCTYPES.xrechnungCii]);
    const toAuthority = await sentInvoice(authority.body.id);
    const mismatch = await auth(api().post(`/invoices/${toAuthority}/peppol`)).expect(400);
    expect(JSON.stringify(mismatch.body)).toContain('PEPPOL_LEITWEG_MISMATCH');

    const draft = await auth(api().post('/invoices'))
      .send({
        clientId: unknown.body.id,
        issueDate: '2026-10-13',
        currency: 'EUR',
        lineItems: [{ description: 'x', quantity: 1, unitPrice: 1, taxRateId: await rateId('DE_STANDARD') }],
      })
      .expect(201);
    const notIssued = await auth(api().post(`/invoices/${draft.body.id}/peppol`)).expect(400);
    expect(JSON.stringify(notIssued.body)).toContain('PEPPOL_NOT_ISSUED');
    expect(sent).toHaveLength(before);
  });

  it('takes received e-invoices in as receipts once, and marks everything read', async () => {
    const supplierXml = writePeppolUbl({
      number: 'BE-2026-77',
      issueDate: '2026-10-12',
      dueDate: '2026-11-11',
      deliveryDate: null,
      currency: 'EUR',
      buyerReference: 'PO-4711',
      note: null,
      seller: {
        name: 'Leverancier BV',
        street: 'Grote Markt 1',
        postalCode: '1000',
        city: 'Brussel',
        countryCode: 'BE',
        vatId: 'BE0123456749',
        email: null,
        peppolId: '0208:0123456749',
        taxNumber: null,
        registrationId: null,
        contactName: null,
        phone: null,
        iban: 'BE68539007547034',
        bic: null,
      },
      buyer: {
        name: 'Muster Design GmbH',
        street: 'Hauptstraße 1',
        postalCode: '10115',
        city: 'Berlin',
        countryCode: 'DE',
        vatId: 'DE123456789',
        email: null,
        peppolId: '9930:DE123456789',
      },
      lines: [{ name: 'Beratung', quantity: 2, unitCode: 'HUR', net: 300, category: 'AE', rate: 0, exemptionReason: 'Reverse charge' }],
    });
    inbox.push(
      { id: 'doc_in_1', type: 'invoice', senderId: '0208:0123456749', xml: supplierXml },
      { id: 'doc_in_mlr', type: 'messageLevelResponse', senderId: '0208:0123456749' },
    );

    const first = await auth(api().post('/integrations/peppol/sync')).expect(201);
    expect(first.body).toEqual({ imported: 1 });
    expect(readIds).toEqual(expect.arrayContaining(['doc_in_1', 'doc_in_mlr']));

    const receipts = await dataSource.query(
      `SELECT id, source, parsed_data FROM receipts WHERE workspace_id = $1 AND source = 'peppol'`,
      [workspaceId],
    );
    expect(receipts).toHaveLength(1);
    expect(JSON.stringify(receipts[0].parsed_data)).toContain('Leverancier BV');

    // Taken in but not marked read (the mark was lost): the next poll does not duplicate it.
    readIds.splice(readIds.indexOf('doc_in_1'), 1);
    const second = await auth(api().post('/integrations/peppol/sync')).expect(201);
    expect(second.body).toEqual({ imported: 0 });
    const again = await dataSource.query(
      `SELECT count(*)::int AS n FROM receipts WHERE workspace_id = $1 AND source = 'peppol'`,
      [workspaceId],
    );
    expect(again[0].n).toBe(1);
    expect(readIds).toContain('doc_in_1');
  });

  it('forgets the account on disconnect', async () => {
    await auth(api().delete('/integrations/peppol')).expect(200);
    const status = await auth(api().get('/integrations/peppol/status')).expect(200);
    expect(status.body.connected).toBe(false);
  });
});
