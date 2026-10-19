jest.mock('franc', () => ({
  franc: () => 'und',
}));
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { deleteUserByEmail, e2eTestingModule, registerAccount } from './helpers/e2e-app';

const FIXTURES = join(__dirname, '../fixtures/e-invoices');

/**
 * Received e-invoices through the normal scan upload: the XML is read as the
 * invoice — no OCR — whether it comes alone or inside a ZUGFeRD PDF, and a
 * supplier in another EU state is reverse-charged from what the invoice says.
 */
describe('Receiving e-invoices (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let workspaceId: string;
  const email = `einvoice-${Date.now()}@example.com`;

  const api = () => request(app.getHttpServer());
  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`).set('x-workspace-id', workspaceId);

  const upload = async (body: Buffer, filename: string, contentType: string) => {
    const res = await auth(api().post('/statements/upload-receipt'))
      .attach('files', body, { filename, contentType });
    expect({ status: res.status, body: res.status === 201 ? null : res.body }).toEqual({
      status: 201,
      body: null,
    });
    const statement = (res.body.data as Array<{ id: string }>)[0];
    const [row] = await dataSource.query(
      `SELECT s.file_type, r.extraction_method, r.parsed_data, t.amount, t.payee_id,
              t.tax_reverse_charge, t.tax_notional_amount
         FROM statements s
         JOIN receipts r ON r.statement_id = s.id
         LEFT JOIN transactions t ON t.statement_id = s.id
        WHERE s.id = $1`,
      [statement.id],
    );
    return row as {
      file_type: string;
      extraction_method: string;
      parsed_data: Record<string, any>;
      amount: string;
      payee_id: string | null;
      tax_reverse_charge: boolean;
      tax_notional_amount: string | null;
    };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const account = await registerAccount(app, email, 'E-Invoice');
    token = account.token;
    workspaceId = account.workspaceId;
    await auth(api().patch(`/workspaces/${workspaceId}`)).send({ currency: 'EUR' }).expect(200);
    await auth(api().put('/tax/settings/jurisdiction'))
      .send({ code: 'DE', effectiveFrom: '2015-01-01' })
      .expect(200);
  });

  afterAll(async () => {
    try {
      await deleteUserByEmail(dataSource, email);
    } finally {
      await app.close();
    }
  });

  it('books an XRechnung uploaded as XML from its own figures', async () => {
    const xml = readFileSync(join(FIXTURES, 'xrechnung/01.01a-INVOICE_uncefact.xml'));
    const row = await upload(xml, 'rechnung.xml', 'application/xml');

    expect(row.file_type).toBe('xml');
    expect(row.extraction_method).toBe('einvoice_xml');
    expect(Number(row.amount)).toBe(336.9);
    expect(row.parsed_data).toMatchObject({
      amount: 336.9,
      tax: 22.04,
      subtotal: 314.86,
      date: '2016-04-04',
      confidence: 1,
      einvoice: {
        syntax: 'cii',
        meetsEn16931: true,
        number: '123456XX',
        iban: 'DE79000000001234567890',
        reverseCharge: false,
      },
    });
  });

  it('reads the XML inside a ZUGFeRD PDF instead of its picture', async () => {
    const pdf = readFileSync(join(FIXTURES, 'zugferd/EN16931_Einfach.pdf'));
    const row = await upload(pdf, 'zugferd.pdf', 'application/pdf');

    expect(row.file_type).toBe('pdf');
    expect(row.extraction_method).toBe('einvoice_xml');
    expect(row.parsed_data.einvoice).toMatchObject({ syntax: 'cii', meetsEn16931: true });
    expect(Number(row.amount)).toBe(row.parsed_data.amount);
  });

  it('flags a MINIMUM profile as not an e-invoice', async () => {
    const pdf = readFileSync(join(FIXTURES, 'zugferd/Facture_DOM_MINIMUM.pdf'));
    const row = await upload(pdf, 'minimum.pdf', 'application/pdf');
    expect(row.parsed_data.validationIssues).toContain('einvoice_not_en16931');
    expect(row.parsed_data.einvoice.meetsEn16931).toBe(false);
  });

  it('takes the seller country and VAT id onto a new payee, and reverse-charges a supplier from another EU state', async () => {
    const xml = readFileSync(join(FIXTURES, 'xrechnung/01.01a-INVOICE_ubl.xml'), 'utf8')
      // The same invoice, issued by an Irish supplier, for a reverse charge.
      .replace(
        /(<cac:AccountingSupplierParty>[\s\S]*?<cbc:IdentificationCode>)DE(<)/,
        '$1IE$2',
      )
      .replace('<cbc:CompanyID>DE 123456789</cbc:CompanyID>', '<cbc:CompanyID>IE6388047V</cbc:CompanyID>')
      .replace('<cbc:ID>123456XX</cbc:ID>', '<cbc:ID>IE-0001</cbc:ID>')
      .replace('<cbc:RegistrationName>[Seller name]</cbc:RegistrationName>', '<cbc:RegistrationName>Dublin Software Ltd</cbc:RegistrationName>');
    const row = await upload(Buffer.from(xml), 'irish.xml', 'text/xml');

    expect(row.parsed_data.einvoice.seller).toMatchObject({
      countryCode: 'IE',
      vatId: 'IE6388047V',
    });
    const [payee] = await dataSource.query(
      'SELECT country_code, vat_id FROM payees WHERE id = $1',
      [row.payee_id],
    );
    expect(payee).toEqual({ country_code: 'IE', vat_id: 'IE6388047V' });

    // Filed under a category in Review, the purchase is reverse-charged.
    const categories = await auth(api().get('/categories?type=expense')).expect(200);
    const category = (categories.body as Array<{ id: string; parentId: string | null; name: string }>)
      .find(item => !item.parentId && item.name !== 'Uncategorized');
    const [tx] = await dataSource.query('SELECT id FROM transactions WHERE payee_id = $1', [
      row.payee_id,
    ]);
    await auth(api().put(`/transactions/${tx.id}`)).send({ categoryId: category?.id }).expect(200);
    const [assessed] = await dataSource.query(
      'SELECT tax_reverse_charge, tax_amount, tax_notional_amount FROM transactions WHERE id = $1',
      [tx.id],
    );
    expect(assessed.tax_reverse_charge).toBe(true);
    expect(Number(assessed.tax_amount)).toBe(0);
    expect(Number(assessed.tax_notional_amount)).toBeGreaterThan(0);
  });

  it('leaves a payee the user already described as it is', async () => {
    // The first invoice of this test file already gave "[Seller name]" its German details.
    const xml = readFileSync(join(FIXTURES, 'xrechnung/01.01a-INVOICE_ubl.xml'), 'utf8')
      .replace('<cbc:CompanyID>DE 123456789</cbc:CompanyID>', '<cbc:CompanyID>DE999999999</cbc:CompanyID>')
      .replace('<cbc:ID>123456XX</cbc:ID>', '<cbc:ID>DE-0002</cbc:ID>');
    const row = await upload(Buffer.from(xml), 'again.xml', 'application/xml');
    const [payee] = await dataSource.query('SELECT vat_id FROM payees WHERE id = $1', [row.payee_id]);
    expect(payee.vat_id).toBe('DE123456789');
  });

  it('refuses an XML file that is not an e-invoice, and other files', async () => {
    await auth(api().post('/statements/upload-receipt'))
      .attach('files', Buffer.from('<?xml version="1.0"?><Document><BkToCstmrStmt/></Document>'), {
        filename: 'statement.xml',
        contentType: 'application/xml',
      })
      .expect(400);
    await auth(api().post('/statements/upload-receipt'))
      .attach('files', Buffer.from('a,b\n1,2'), { filename: 'x.csv', contentType: 'text/csv' })
      .expect(400);
  });
});
