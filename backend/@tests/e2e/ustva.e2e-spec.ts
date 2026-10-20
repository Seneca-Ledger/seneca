jest.mock('franc', () => ({
  franc: () => 'und',
}));
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { deleteUserByEmail, e2eTestingModule, registerAccount } from './helpers/e2e-app';

/**
 * The German VAT advance return built from real rows: a domestic purchase
 * on line 38, and a service bought from another EU state that stays open
 * until its payee is marked as supplying services, then lands on lines 30
 * and 41.
 */
describe('UStVA Kennzahlen (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let workspaceId: string;
  const email = `ustva-${Date.now()}@example.com`;

  const api = () => request(app.getHttpServer());
  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`).set('x-workspace-id', workspaceId);
  const ustva = (start: string, end: string) =>
    auth(api().get(`/tax/returns/ustva?periodStart=${start}&periodEnd=${end}`)).expect(200);

  const expense = async (date: string, merchant: string) => {
    const categories = await auth(api().get('/categories?type=expense')).expect(200);
    const category = (
      categories.body as Array<{ id: string; parentId: string | null; name: string }>
    ).find(item => !item.parentId && item.name !== 'Uncategorized');
    const created = await auth(api().post('/statements/manual-expense'))
      .field('amount', '119')
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', category?.id ?? '')
      .field('date', date)
      .expect(201);
    const [row] = await dataSource.query(
      'SELECT id, payee_id FROM transactions WHERE statement_id = $1',
      [created.body.id],
    );
    return row as { id: string; payee_id: string };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const account = await registerAccount(app, email, 'UStVA');
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

  it('puts the input tax of a domestic purchase on line 38', async () => {
    await expense('2026-03-10', 'Bürobedarf Müller GmbH');
    const res = await ustva('2026-03-01', '2026-03-31');
    expect(res.body).toMatchObject({ unsupported: null, missingRates: [] });
    expect(res.body.form.fields).toEqual([
      expect.objectContaining({ kz: '66', line: 38, kind: 'tax', amount: 19 }),
    ]);
    expect(res.body.form.kz83).toBe(-19);
  });

  it('keeps a reverse-charged EU purchase open until its payee says services', async () => {
    const row = await expense('2026-03-12', 'Google Ireland Ltd');
    await auth(api().patch(`/payees/${row.payee_id}`))
      .send({ countryCode: 'IE', vatId: 'IE6388047V' })
      .expect(200);

    const open = await ustva('2026-03-01', '2026-03-31');
    expect(open.body.form.open).toEqual([
      expect.objectContaining({
        reason: 'supply_type_unknown',
        direction: 'expense',
        net: 119,
        tax: 22.61,
        payeeId: row.payee_id,
      }),
    ]);

    const updated = await auth(api().patch(`/payees/${row.payee_id}`))
      .send({ supplyType: 'services' })
      .expect(200);
    expect(updated.body.supplyType).toBe('services');

    const placed = await ustva('2026-03-01', '2026-03-31');
    const kz = Object.fromEntries(
      (placed.body.form.fields as Array<{ kz: string; amount: number }>).map(f => [f.kz, f.amount]),
    );
    expect(kz).toEqual({ '46': 119, '47': 22.61, '66': 19, '67': 22.61 });
    expect(placed.body.form.open).toEqual([]);
    // The § 13b tax is owed and deducted again: only the domestic input tax is left.
    expect(placed.body.form.kz83).toBe(-19);

    await auth(api().patch(`/payees/${row.payee_id}`))
      .send({ supplyType: 'cars' })
      .expect(400);
  });

  it('says so for a year whose form was not read, and for a period across two years', async () => {
    expect((await ustva('2025-12-01', '2025-12-31')).body).toMatchObject({
      unsupported: 'form_year_unknown',
      form: null,
    });
    expect((await ustva('2025-12-01', '2026-01-31')).body.unsupported).toBe('period_spans_years');
  });

  it('rejects a period that is not two ISO dates', async () => {
    await auth(api().get('/tax/returns/ustva?periodStart[x]=1&periodEnd=2026-03-31')).expect(400);
    await auth(
      api().get('/tax/returns/ustva?periodStart=2026-01-01&periodStart=2026-02-01&periodEnd=2026-03-31'),
    ).expect(400);
    await auth(
      api().get('/tax/returns/export?periodStart=2026-01-01&periodEnd=2026-03-31&format=html'),
    ).expect(400);
  });

  it('is only for a VAT-registered business in Germany', async () => {
    await auth(api().put('/tax/settings/vat-status')).send({ status: 'small_business' }).expect(200);
    expect((await ustva('2026-03-01', '2026-03-31')).body.unsupported).toBe('not_registered');
    await auth(api().put('/tax/settings/vat-status')).send({ status: 'registered' }).expect(200);
  });
});
