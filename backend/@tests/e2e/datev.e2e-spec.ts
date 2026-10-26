vi.mock('franc', () => ({
  franc: () => 'und',
}));
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { deleteUserByEmail, e2eTestingModule, registerAccount } from './helpers/e2e-app';
import { APP_NAME } from '../../src/common/brand';

/**
 * The DATEV export end to end: settings, the category → account mapping, the
 * preview of what goes out and what does not, and the file DATEV imports.
 */
describe('DATEV export (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let workspaceId: string;
  const email = `datev-${Date.now()}@example.com`;
  const api = () => request(app.getHttpServer());
  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`).set('x-workspace-id', workspaceId);

  let office: string;
  let rent: string;
  let sales: string;

  const expense = async (amount: string, merchant: string, categoryId: string, date: string) => {
    const created = await auth(api().post('/statements/manual-expense'))
      .field('amount', amount)
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', date)
      .expect(201);
    const [row] = await dataSource.query('SELECT id FROM transactions WHERE statement_id = $1', [
      created.body.id,
    ]);
    return row.id as string;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const account = await registerAccount(app, email, 'Datev Test');
    token = account.token;
    workspaceId = account.workspaceId;
    await auth(api().patch(`/workspaces/${workspaceId}`)).send({ currency: 'EUR' }).expect(200);
    await auth(api().put('/tax/settings/jurisdiction'))
      .send({ code: 'DE', effectiveFrom: '2025-01-01' })
      .expect(200);

    const all = await auth(api().get('/categories')).expect(200);
    const find = (name: string) =>
      (all.body as Array<{ id: string; name: string }>).find(category => category.name === name)
        ?.id as string;
    office = find('Office supplies');
    rent = find('Rent');
    sales = find('Sales');

    await expense('119', 'Büro Müller GmbH', office, '2026-03-10');
    await expense('1190', 'Coworking Berlin', rent, '2026-03-01');
    const sale = await expense('5950', 'Kunde AG', office, '2026-03-15');
    await auth(api().put(`/transactions/${sale}`))
      .send({ debit: 0, credit: 5950, categoryId: sales })
      .expect(200);
    await expense('20', 'Somewhere', find('Travel'), '2026-03-20');

    // A purchase in dollars, at a rate stored for its day (no network needed).
    await dataSource.query(
      `INSERT INTO exchange_rates (base_currency, target_currency, rate, rate_date, source)
       VALUES ('USD', 'EUR', 0.9, '2026-03-25', 'e2e')
       ON CONFLICT (base_currency, target_currency, rate_date) DO UPDATE SET rate = 0.9`,
    );
    const created = await auth(api().post('/statements/manual-expense'))
      .field('amount', '100')
      .field('currency', 'USD')
      .field('merchant', 'GitHub Inc')
      .field('categoryId', office)
      .field('date', '2026-03-25')
      .expect(201);
    // As if it had come in on the statement of a second bank account.
    await dataSource.query('UPDATE statements SET account_number = $1 WHERE id = $2', [
      'DE02120300000000202051',
      created.body.id,
    ]);
  });

  afterAll(async () => {
    try {
      await deleteUserByEmail(dataSource, email);
      await dataSource.query("DELETE FROM exchange_rates WHERE source = 'e2e'");
    } finally {
      await app.close();
    }
  });

  it('is offered to a German business, with SKR 03 and its bank account by default', async () => {
    const settings = await auth(api().get('/tax/datev/settings')).expect(200);
    expect(settings.body).toMatchObject({ available: true, chart: '03', bankAccount: '1200' });
  });

  it('lists the bank accounts the statements came from', async () => {
    const mapping = await auth(api().get('/tax/datev/mapping?year=2026')).expect(200);
    expect(mapping.body.bankAccounts).toEqual([
      { accountNumber: 'DE02120300000000202051', transactionCount: 1, account: null },
    ]);
  });

  it('suggests accounts from the chart, and maps nothing on its own', async () => {
    const mapping = await auth(api().get('/tax/datev/mapping?year=2026')).expect(200);
    const byName = Object.fromEntries(
      (mapping.body.categories as Array<{ name: string; account: string | null; suggestion: { account: string } | null }>).map(
        row => [row.name, row],
      ),
    );
    expect(byName['Office supplies']).toMatchObject({ account: null, suggestion: { account: '4930' } });
    expect(byName.Sales.suggestion.account).toBe('8400');
    expect(byName.Travel.suggestion).toBeNull();
  });

  it('refuses a file without the adviser and client numbers', async () => {
    const preview = await auth(api().get('/tax/datev/preview?from=2026-03-01&to=2026-03-31')).expect(200);
    expect(preview.body.missingSettings).toEqual(['consultantNumber', 'clientNumber']);
    await auth(api().get('/tax/datev/export?from=2026-03-01&to=2026-03-31')).expect(400);
  });

  it('previews what goes out and what is left out', async () => {
    await auth(api().put('/tax/datev/settings'))
      .send({
        chart: '03',
        consultantNumber: 29098,
        clientNumber: 55003,
        bankAccount: null,
        accounts: { [office]: '4930', [rent]: '4210', [sales]: '8400' },
        bankAccounts: { DE02120300000000202051: '1210' },
      })
      .expect(200);

    const preview = await auth(api().get('/tax/datev/preview?from=2026-03-01&to=2026-03-31')).expect(200);
    expect(preview.body).toMatchObject({ bookings: 4, converted: 1, missingSettings: [], issues: [] });
    expect(preview.body.skipped.unmapped).toEqual([
      expect.objectContaining({ name: 'Travel', count: 1 }),
    ]);
  });

  it('writes a Windows-1252 EXTF file DATEV can import', async () => {
    const res = await auth(api().get('/tax/datev/export?from=2026-03-01&to=2026-03-31'))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-disposition']).toContain('EXTF_Buchungsstapel_20260301_20260331.csv');

    const bytes = res.body as Buffer;
    // "ü" of "Büro" is the single Windows-1252 byte 0xFC, not UTF-8's 0xC3 0xBC.
    expect(bytes.includes(0xfc)).toBe(true);
    expect(bytes.includes(Buffer.from('ü', 'utf8'))).toBe(false);

    const lines = bytes.toString('latin1').split('\r\n');
    expect(lines[0]).toMatch(/^"EXTF";700;21;"Buchungsstapel";13;\d{17};;"RE";"[^"]*";"";29098;55003;20260101;4;20260301;20260331;/);
    expect(lines[0]).toContain(`;"RE";"${APP_NAME}";`);
    const rows = lines.slice(2, -1).map(line => line.split(';').slice(0, 10).join(';'));
    expect(rows).toEqual(
      expect.arrayContaining([
        // Rent is an ordinary account: 19 % input tax travels as key 401.
        '1190,00;"H";"";;;"";1200;4210;"401";0103',
        '119,00;"H";"";;;"";1200;4930;"401";1003',
        // 8400 is an automatic account: DATEV books the 19 % itself, no key.
        '5950,00;"S";"";;;"";1200;8400;"";1503',
        // 100 USD at 0.9, against the second bank account's own DATEV account.
        '90,00;"H";"";;;"";1210;4930;"401";2503',
      ]),
    );
    expect(rows).toHaveLength(4);
    expect(lines.find(line => line.startsWith('90,00'))).toContain('"GitHub Inc (USD 100.00)"');
  });

  it('gives no tax keys once the business is not VAT-registered', async () => {
    await auth(api().put('/tax/settings/vat-status')).send({ status: 'small_business' }).expect(200);
    const res = await auth(api().get('/tax/datev/export?from=2026-03-01&to=2026-03-31'))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);
    const keys = (res.body as Buffer)
      .toString('latin1')
      .split('\r\n')
      .slice(2, -1)
      .map(line => line.split(';')[8]);
    expect(keys).toEqual(['""', '""', '""', '""']);
  });

  it('keeps one file within one calendar year', async () => {
    await auth(api().get('/tax/datev/preview?from=2025-12-01&to=2026-01-31')).expect(400);
  });
});
