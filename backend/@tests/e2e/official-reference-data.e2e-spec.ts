jest.mock('franc', () => ({
  franc: () => 'und',
}));
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  e2eTestingModule,
  referenceFetch,
  registerAccount,
} from './helpers/e2e-app';

/** A TEDB answer: one standard and one reduced rate per version. */
function tedbXml(versions: Array<{ from: string; standard: number; reduced: number }>): string {
  const results = versions.flatMap(version => [
    `<vatRateResults><memberState>DE</memberState><type>STANDARD</type><rate><type>DEFAULT</type><value>${version.standard}.0</value></rate><situationOn>${version.from}+01:00</situationOn></vatRateResults>`,
    `<vatRateResults><memberState>DE</memberState><type>REDUCED</type><rate><type>REDUCED_RATE</type><value>${version.reduced}.0</value></rate><situationOn>${version.from}+01:00</situationOn><category><identifier>FOODSTUFFS</identifier><description>x</description></category></vatRateResults>`,
  ]);
  return `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><ns0:retrieveVatRatesRespMsg xmlns="urn:t" xmlns:ns0="urn:m"><additionalInformation/>${results.join('')}</ns0:retrieveVatRatesRespMsg></env:Body></env:Envelope>`;
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

/**
 * Reference data from outside, against a real database, with the network
 * replaced by fixed answers: VAT numbers checked in VIES, the EU's official
 * VAT rates compared and applied, and deadlines moved off public holidays.
 */
describe('Official reference data (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let token: string;
  let workspaceId: string;
  const email = `reference-data-${Date.now()}@example.com`;

  /** What the fake VIES says per number. */
  const vies: Record<string, unknown> = {};
  let tedb = tedbXml([{ from: '2025-01-01', standard: 19, reduced: 7 }]);
  const christmas = (year: number) => ({
    startDate: `${year}-12-25`,
    endDate: `${year}-12-26`,
    type: 'Public',
    nationwide: true,
  });
  let holidays: Array<{ startDate: string; endDate: string; type: string; nationwide: boolean }> =
    [2025, 2026, 2027].map(christmas);

  const api = () => request(app.getHttpServer());
  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${token}`).set('x-workspace-id', workspaceId);

  const expense = async (date: string, merchant: string) => {
    const categories = await auth(api().get('/categories?type=expense')).expect(200);
    const category = (categories.body as Array<{ id: string; parentId: string | null; name: string }>)
      .find(item => !item.parentId && item.name !== 'Uncategorized');
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

  const taxOf = async (id: string) => {
    const [row] = await dataSource.query(
      'SELECT tax_amount, tax_reverse_charge FROM transactions WHERE id = $1',
      [id],
    );
    return { amount: Number(row.tax_amount), reverseCharged: row.tax_reverse_charge as boolean };
  };

  beforeAll(async () => {
    referenceFetch.handler = async (input, init) => {
      const url = String(input);
      if (url.includes('/vies/')) {
        const number = url.split('/').pop() ?? '';
        return json(vies[number] ?? { isValid: false, userError: 'MS_UNAVAILABLE' });
      }
      if (url.includes('/tedb/')) {
        expect(String(init?.body)).toContain('<t:isoCode>DE</t:isoCode>');
        return new Response(tedb, { status: 200 });
      }
      if (url.includes('openholidaysapi.org')) {
        const year = new URL(url).searchParams.get('validFrom')?.slice(0, 4);
        return json(holidays.filter(holiday => holiday.startDate.startsWith(String(year))));
      }
      throw new Error(`Unexpected request to ${url}`);
    };

    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    const account = await registerAccount(app, email, 'Reference Data');
    token = account.token;
    workspaceId = account.workspaceId;
    await auth(api().patch(`/workspaces/${workspaceId}`)).send({ currency: 'EUR' }).expect(200);
    await auth(api().put('/tax/settings/jurisdiction'))
      .send({ code: 'DE', effectiveFrom: '2025-01-01' })
      .expect(200);
  });

  afterAll(async () => {
    referenceFetch.handler = null;
    try {
      await dataSource.query(`DELETE FROM reference_data WHERE source IN ('tedb', 'openholidays')`);
      await deleteUserByEmail(dataSource, email);
    } finally {
      await app.close();
    }
  });

  describe('VAT numbers in VIES', () => {
    it('does not reverse-charge a supplier whose number VIES calls invalid', async () => {
      const row = await expense('2026-03-10', 'Invalid Supplier Sp. z o.o.');
      vies['1111111111'] = { isValid: false, userError: 'INVALID', name: '---' };

      const updated = await auth(api().patch(`/payees/${row.payee_id}`))
        .send({ countryCode: 'PL', vatId: 'PL 111 111 1111' })
        .expect(200);

      expect(updated.body).toMatchObject({ vatIdStatus: 'invalid', vatIdName: null });
      expect(updated.body.vatIdCheckedAt).toBeTruthy();
      expect(await taxOf(row.id)).toEqual({ amount: 19, reverseCharged: false });
    });

    it('reverse-charges a valid one and keeps the registered name', async () => {
      const row = await expense('2026-03-11', 'Valid Supplier Sp. z o.o.');
      vies['2222222222'] = { isValid: true, userError: 'VALID', name: 'VALID SUPPLIER SP Z O O' };

      const updated = await auth(api().patch(`/payees/${row.payee_id}`))
        .send({ countryCode: 'PL', vatId: 'PL2222222222' })
        .expect(200);

      expect(updated.body).toMatchObject({
        vatIdStatus: 'valid',
        vatIdName: 'VALID SUPPLIER SP Z O O',
      });
      expect(await taxOf(row.id)).toEqual({ amount: 0, reverseCharged: true });

      const list = await auth(api().get('/payees?search=Valid%20Supplier')).expect(200);
      expect(list.body.data[0]).toMatchObject({ vatIdStatus: 'valid' });
    });

    it('takes an unanswered number as given, and checks again on request', async () => {
      const row = await expense('2026-03-12', 'Unchecked Supplier Sp. z o.o.');

      const updated = await auth(api().patch(`/payees/${row.payee_id}`))
        .send({ countryCode: 'PL', vatId: 'PL3333333333' })
        .expect(200);
      expect(updated.body.vatIdStatus).toBeNull();
      expect((await taxOf(row.id)).reverseCharged).toBe(true);

      // The register answers now, and the number turns out to be invalid.
      vies['3333333333'] = { isValid: false, userError: 'INVALID' };
      const rechecked = await auth(api().post(`/payees/${row.payee_id}/vat-check`)).expect(201);
      expect(rechecked.body.vatIdStatus).toBe('invalid');
      expect(await taxOf(row.id)).toEqual({ amount: 19, reverseCharged: false });
    });
  });

  describe('official VAT rates (TEDB)', () => {
    it('finds nothing to change when the rates match', async () => {
      const check = await auth(api().post('/tax/settings/official-rates/refresh')).expect(201);
      expect(check.body).toMatchObject({ supported: true, country: 'DE', differences: [] });
      expect(check.body.fetchedAt).toBeTruthy();
    });

    it('applies an announced change of the standard rate from its date', async () => {
      const before = await expense('2026-12-20', 'Before The Change GmbH');
      const after = await expense('2027-01-15', 'After The Change GmbH');
      expect((await taxOf(after.id)).amount).toBe(19);

      tedb = tedbXml([
        { from: '2025-01-01', standard: 19, reduced: 7 },
        { from: '2027-01-01', standard: 20, reduced: 7 },
      ]);
      const check = await auth(api().post('/tax/settings/official-rates/refresh')).expect(201);
      expect(check.body.differences).toEqual([
        expect.objectContaining({
          key: 'standard_changed:20:2027-01-01',
          official: 20,
          ours: 19,
          from: '2027-01-01',
          canApply: true,
        }),
      ]);

      const applied = await auth(api().post('/tax/settings/official-rates/apply'))
        .send({ key: 'standard_changed:20:2027-01-01' })
        .expect(201);
      expect(applied.body.differences).toEqual([]);

      // 119 gross at 20%: 119 × 20 / 120 = 19.83; the December row keeps 19%.
      expect((await taxOf(after.id)).amount).toBe(19.83);
      expect((await taxOf(before.id)).amount).toBe(19);
      const rates = await auth(api().get('/tax/settings/rates?date=2027-01-15')).expect(200);
      const byCode = Object.fromEntries(
        (rates.body as Array<{ code: string; rate: string }>).map(rate => [rate.code, Number(rate.rate)]),
      );
      expect(byCode).toMatchObject({ DE_STANDARD: 20, DE_STANDARD_RC: 20 });
    });

    it('lets a difference be dismissed and brought back', async () => {
      tedb = tedbXml([
        { from: '2025-01-01', standard: 19, reduced: 7 },
        { from: '2026-07-01', standard: 19, reduced: 5 },
        { from: '2027-01-01', standard: 20, reduced: 5 },
      ]);
      const check = await auth(api().post('/tax/settings/official-rates/refresh')).expect(201);
      const keys = (check.body.differences as Array<{ key: string }>).map(item => item.key);
      expect(keys).toEqual(expect.arrayContaining(['reduced_missing:5:2026-07-01', 'reduced_unlisted:7']));

      const dismissed = await auth(api().put('/tax/settings/official-rates/dismissed'))
        .send({ key: 'reduced_unlisted:7', dismissed: true })
        .expect(200);
      expect(dismissed.body.dismissed.map((item: { key: string }) => item.key)).toEqual([
        'reduced_unlisted:7',
      ]);
      expect(dismissed.body.differences.map((item: { key: string }) => item.key)).not.toContain(
        'reduced_unlisted:7',
      );

      await auth(api().put('/tax/settings/official-rates/dismissed'))
        .send({ key: 'reduced_unlisted:7', dismissed: false })
        .expect(200);
      await auth(api().post('/tax/settings/official-rates/apply'))
        .send({ key: 'reduced_unlisted:7' })
        .expect(400);
      await auth(api().post('/tax/settings/official-rates/apply'))
        .send({ key: 'not a key' })
        .expect(400);
    });
  });

  describe('deadlines and public holidays', () => {
    it('moves the income tax deadline past a holiday', async () => {
      // Tax year 2026 is due 31 July 2027, a Saturday: Monday 2 August.
      const plain = await auth(api().get('/tax/deadlines')).expect(200);
      const income = (plain.body as Array<{ kind: string; periodEnd: string; dueDate: string }>).find(
        item => item.kind === 'income_tax' && item.periodEnd === '2026-12-31',
      );
      expect(income).toMatchObject({ dueDate: '2027-08-02', basis: 'statute' });

      // Say Monday 2 August 2027 were a nationwide holiday.
      holidays = [
        ...holidays,
        { startDate: '2027-08-02', endDate: '2027-08-02', type: 'Public', nationwide: true },
      ];
      await dataSource.query(`DELETE FROM reference_data WHERE source = 'openholidays'`);
      const moved = await auth(api().get('/tax/deadlines')).expect(200);
      expect(
        (moved.body as Array<{ kind: string; periodEnd: string; dueDate: string }>).find(
          item => item.kind === 'income_tax' && item.periodEnd === '2026-12-31',
        )?.dueDate,
      ).toBe('2027-08-03');
    });
  });
});
