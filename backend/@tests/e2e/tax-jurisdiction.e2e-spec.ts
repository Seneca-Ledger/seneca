import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { accessTokenOf, e2eTestingModule } from './helpers/e2e-app';

/**
 * Period arithmetic for tax rates lives in SQL — overlap predicates, a partial
 * unique index and a CHECK constraint — so it can only be proven against a real
 * database. These are the invariants a wrong return would trace back to.
 */
describe('Tax jurisdictions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let workspaceId: string;

  const auth = (req: request.Test) =>
    req.set('Authorization', `Bearer ${accessToken}`).set('x-workspace-id', workspaceId);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    const register = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'tax-jurisdiction@example.com',
      password: 'Test123!@#',
      name: 'Tax Tester',
    });

    const login = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'tax-jurisdiction@example.com',
      password: 'Test123!@#',
    });

    accessToken = accessTokenOf(login);
    workspaceId = login.body?.user?.workspaceId;

    // Without this guard a broken login yields `Bearer undefined`, every request
    // 401s, and the assertions that only touch the database pass vacuously —
    // which reads as a partially working feature instead of a broken fixture.
    if (!(accessToken && workspaceId)) {
      throw new Error(
        `Auth setup failed. register ${register.status}: ${JSON.stringify(register.body)} | ` +
          `login ${login.status}: ${JSON.stringify(login.body)}`,
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  const ratesOn = async (date: string) => {
    const response = await auth(
      request(app.getHttpServer()).get(`/tax/settings/rates?date=${date}`),
    ).expect(200);
    return response.body as Array<{
      code: string | null;
      rate: string;
      kind: string;
      isDefault: boolean;
    }>;
  };

  describe('catalogue', () => {
    it('lists the seeded jurisdictions', async () => {
      const response = await request(app.getHttpServer())
        .get('/tax/jurisdictions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const codes = response.body.map((j: { code: string }) => j.code).sort();
      // The original six plus the 25 EU member states added by AddEuTaxJurisdictions.
      expect(codes).toEqual([
        'AE', 'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB', 'GR', 'HR',
        'HU', 'IE', 'IT', 'KZ', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
        'US',
      ]);
    });

    it('resolves statutory rates as of a date', async () => {
      const before = await request(app.getHttpServer())
        .get('/tax/jurisdictions/KZ/rates?date=2025-12-31')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const after = await request(app.getHttpServer())
        .get('/tax/jurisdictions/KZ/rates?date=2026-01-01')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const standardRate = (body: Array<{ kind: string; rate: string }>) =>
        Number(body.filter(r => r.kind === 'standard')[0].rate);

      expect(standardRate(before.body)).toBe(12);
      expect(standardRate(after.body)).toBe(16);
    });

    it('accepts a lower-case country code', async () => {
      await request(app.getHttpServer())
        .get('/tax/jurisdictions/kz')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
    });

    it('404s on an unknown country', async () => {
      await request(app.getHttpServer())
        .get('/tax/jurisdictions/XX')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('adopting a jurisdiction', () => {
    it('copies the statutory rate set into the workspace', async () => {
      const response = await auth(
        request(app.getHttpServer())
          .put('/tax/settings/jurisdiction')
          .send({ code: 'KZ', effectiveFrom: '2025-03-01' }),
      ).expect(200);

      expect(response.body).toMatchObject({ jurisdictionCode: 'KZ', adopted: 4, retired: 0 });
    });

    it('reports the workspace jurisdiction', async () => {
      const response = await auth(request(app.getHttpServer()).get('/tax/settings')).expect(200);
      expect(response.body.jurisdiction.code).toBe('KZ');
    });

    it('applies 12% in 2025 and 16% in 2026', async () => {
      const standard2025 = (await ratesOn('2025-06-01')).filter(r => r.kind === 'standard');
      const standard2026 = (await ratesOn('2026-06-01')).filter(r => r.kind === 'standard');

      expect(standard2025).toHaveLength(1);
      expect(Number(standard2025[0].rate)).toBe(12);
      expect(standard2026).toHaveLength(1);
      expect(Number(standard2026[0].rate)).toBe(16);
    });

    it('never leaves more than one default in force', async () => {
      for (const date of ['2025-06-01', '2025-12-31', '2026-01-01', '2026-06-01']) {
        const defaults = (await ratesOn(date)).filter(r => r.isDefault);
        expect({ date, count: defaults.length }).toEqual({ date, count: 1 });
      }
    });

    it('drops the seeded zero rate from being the default', async () => {
      // createDefaultTaxRates seeds 'Tax exempt (0%)' as the default. Adoption
      // must demote it, or resolution on any date becomes a coin flip.
      const seeded = await dataSource.query(
        `SELECT is_default FROM tax_rates WHERE workspace_id = $1 AND code IS NULL`,
        [workspaceId],
      );
      for (const row of seeded) {
        expect(row.is_default).toBe(false);
      }
    });
  });

  describe('switching jurisdiction', () => {
    let pinnedRateId: string;

    beforeAll(async () => {
      const [rate] = await dataSource.query(
        `SELECT id FROM tax_rates
          WHERE workspace_id = $1 AND code = 'KZ_STANDARD' AND valid_from = '1900-01-01'`,
        [workspaceId],
      );
      pinnedRateId = rate.id;

      // A purchase taxed under KZ 12%, pinned to that exact rate version.
      await dataSource.query(
        `INSERT INTO transactions
           (transaction_date, counterparty_name, payment_purpose, transaction_type,
            workspace_id, tax_rate_id, currency)
         VALUES ('2025-06-01', 'Probe vendor', 'Probe purchase', 'expense', $1, $2, 'KZT')`,
        [workspaceId, pinnedRateId],
      );

      await auth(
        request(app.getHttpServer())
          .put('/tax/settings/jurisdiction')
          .send({ code: 'DE', effectiveFrom: '2026-03-01' }),
      ).expect(200);
    });

    it('leaves no transaction pointing at a missing rate', async () => {
      const [{ orphans }] = await dataSource.query(
        `SELECT count(*)::int AS orphans
           FROM transactions t
           LEFT JOIN tax_rates r ON r.id = t.tax_rate_id
          WHERE t.workspace_id = $1 AND t.tax_rate_id IS NOT NULL AND r.id IS NULL`,
        [workspaceId],
      );
      expect(orphans).toBe(0);
    });

    it('keeps a statutorily-closed rate on its own end date', async () => {
      // KZ 12% ended on 2025-12-31 by law, before the switch. Stamping the
      // switch date on it would resurrect a rate for two months in which it
      // did not legally exist.
      // Cast in SQL rather than reading a JS Date: the driver hands back local
      // midnight, and toISOString would shift it a day in any zone east of UTC.
      const [rate] = await dataSource.query(
        `SELECT rate, valid_to::text AS valid_to FROM tax_rates WHERE id = $1`,
        [pinnedRateId],
      );
      expect(Number(rate.rate)).toBe(12);
      expect(rate.valid_to).toBe('2025-12-31');
    });

    it('closes the rate that was live at the switch on the day before', async () => {
      const [rate] = await dataSource.query(
        `SELECT valid_to::text AS valid_to FROM tax_rates
          WHERE workspace_id = $1 AND code = 'KZ_STANDARD' AND valid_from = '2026-01-01'`,
        [workspaceId],
      );
      expect(rate.valid_to).toBe('2026-02-28');
    });

    it('resolves German rates after the switch and Kazakh ones before it', async () => {
      const after = await ratesOn('2026-06-01');
      expect(after.some(r => r.code?.startsWith('KZ'))).toBe(false);
      expect(Number(after.find(r => r.isDefault)!.rate)).toBe(19);

      const before = await ratesOn('2025-06-01');
      expect(Number(before.filter(r => r.kind === 'standard')[0].rate)).toBe(12);
    });

    it('is idempotent when the same jurisdiction is adopted again', async () => {
      await auth(
        request(app.getHttpServer())
          .put('/tax/settings/jurisdiction')
          .send({ code: 'DE', effectiveFrom: '2026-03-01' }),
      ).expect(200);

      const [{ count }] = await dataSource.query(
        `SELECT count(*)::int FROM tax_rates
          WHERE workspace_id = $1 AND code LIKE 'DE_%'`,
        [workspaceId],
      );
      expect(count).toBe(3);
    });

    it('rejects an unknown country without touching the rate set', async () => {
      await auth(
        request(app.getHttpServer()).put('/tax/settings/jurisdiction').send({ code: 'XX' }),
      ).expect(404);

      const settings = await auth(request(app.getHttpServer()).get('/tax/settings')).expect(200);
      expect(settings.body.jurisdiction.code).toBe('DE');
    });

    it('rejects a malformed country code', async () => {
      await auth(
        request(app.getHttpServer()).put('/tax/settings/jurisdiction').send({ code: 'DEU' }),
      ).expect(400);
    });
  });

  describe('database guards', () => {
    it('refuses a validity period that ends before it starts', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO tax_rates (workspace_id, name, rate, valid_from, valid_to)
           VALUES ($1, 'Backwards', 10, '2026-01-01', '2025-01-01')`,
          [workspaceId],
        ),
      ).rejects.toThrow();
    });

    it('refuses two versions of one rate code starting the same day', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO tax_rates (workspace_id, name, rate, code, valid_from)
           VALUES ($1, 'Duplicate', 19, 'DE_STANDARD', '1900-01-01')`,
          [workspaceId],
        ),
      ).rejects.toThrow();
    });
  });
});
