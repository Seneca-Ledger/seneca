import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { accessTokenOf, e2eTestingModule } from './helpers/e2e-app';

/**
 * The income-tax draft end to end: the disclaimer gate, the confirmed-only
 * mapping rule, finalizing, and that nothing leaks across workspaces.
 */
describe('Income tax (e2e)', () => {
  let app: INestApplication;
  const taxYear = 2025;

  interface Session {
    accessToken: string;
    workspaceId: string;
  }
  let owner: Session;
  let stranger: Session;

  const as = (session: Session, req: request.Test) =>
    req.set('Authorization', `Bearer ${session.accessToken}`).set('x-workspace-id', session.workspaceId);

  async function signUp(email: string): Promise<Session> {
    const server = app.getHttpServer();
    const register = await request(server)
      .post('/auth/register')
      .send({ email, password: 'Test123!@#', name: 'Income Tax Tester' });
    const login = await request(server).post('/auth/login').send({ email, password: 'Test123!@#' });

    // Login sets the token as an HttpOnly cookie; sent back as a bearer header
    // it authenticates without the CSRF round-trip a cookie session needs.
    const cookieToken = ([] as string[])
      .concat(login.headers['set-cookie'] ?? [])
      .map(cookie => cookie.split(';')[0])
      .find(cookie => cookie.startsWith('access_token='))
      ?.slice('access_token='.length);
    const session = {
      accessToken: accessTokenOf(login) ?? cookieToken,
      workspaceId: login.body?.user?.workspaceId,
    };
    // A broken login would make every assertion below fail for the wrong reason.
    if (!(session.accessToken && session.workspaceId)) {
      throw new Error(
        `Auth setup failed for ${email}. register ${register.status}: ${JSON.stringify(register.body)} | ` +
          `login ${login.status}: ${JSON.stringify(login.body)}`,
      );
    }
    return session;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    const suffix = Date.now();
    owner = await signUp(`income-tax-owner-${suffix}@example.com`);
    stranger = await signUp(`income-tax-stranger-${suffix}@example.com`);
  });

  afterAll(async () => {
    await app.close();
  });

  it('asks for a tax country before building anything', async () => {
    const profile = await as(
      owner,
      request(app.getHttpServer()).get(`/income-tax/profile?taxYear=${taxYear}`),
    ).expect(200);
    expect(profile.body).toMatchObject({ country: null, pack: null });

    const draft = await as(
      owner,
      request(app.getHttpServer()).get(`/income-tax/returns/${taxYear}`),
    ).expect(400);
    expect(JSON.stringify(draft.body)).toContain('TAX_JURISDICTION_REQUIRED');
  });

  describe('with Germany as the tax country', () => {
    beforeAll(async () => {
      await as(owner, request(app.getHttpServer()).put('/tax/settings/jurisdiction'))
        .send({ code: 'DE' })
        .expect(200);
    });

    it('resolves the Anlage EÜR for a self-employed profile', async () => {
      const response = await as(owner, request(app.getHttpServer()).put('/income-tax/profile'))
        .send({ taxYear, taxpayerType: 'self_employed', details: { homeOfficeDays: 250 } })
        .expect(200);

      expect(response.body).toMatchObject({
        country: { code: 'DE' },
        pack: { formKey: 'de-euer', isGeneric: false },
      });
    });

    it('rejects an invalid tax year and taxpayer type', async () => {
      await as(owner, request(app.getHttpServer()).get('/income-tax/returns/1999')).expect(400);
      await as(owner, request(app.getHttpServer()).put('/income-tax/profile'))
        .send({ taxYear, taxpayerType: 'pirate' })
        .expect(400);
    });

    it('proposes lines but counts only confirmed ones', async () => {
      const mappings = await as(
        owner,
        request(app.getHttpServer()).get(`/income-tax/mappings?taxYear=${taxYear}`),
      ).expect(200);
      const rent = mappings.body.categories.find((c: { name: string }) => c.name === 'Rent');
      expect(rent).toMatchObject({ lineKey: 'rent', status: 'suggested' });

      await as(owner, request(app.getHttpServer()).put('/income-tax/mappings'))
        .send({ taxYear, entries: [{ categoryId: rent.categoryId, lineKey: 'rent' }] })
        .expect(200);

      const after = await as(
        owner,
        request(app.getHttpServer()).get(`/income-tax/mappings?taxYear=${taxYear}`),
      ).expect(200);
      expect(
        after.body.categories.find((c: { categoryId: string }) => c.categoryId === rent.categoryId),
      ).toMatchObject({ status: 'confirmed' });
    });

    it('rejects a line the form does not have and a category from another workspace', async () => {
      const theirs = await as(
        stranger,
        request(app.getHttpServer()).get('/categories'),
      ).expect(200);
      const strangerCategories = Array.isArray(theirs.body) ? theirs.body : theirs.body.data;
      const foreignCategoryId = strangerCategories[0].id;

      await as(owner, request(app.getHttpServer()).put('/income-tax/mappings'))
        .send({ taxYear, entries: [{ categoryId: foreignCategoryId, lineKey: 'rent' }] })
        .expect(400);
      await as(owner, request(app.getHttpServer()).put('/income-tax/mappings'))
        .send({ taxYear, entries: [{ categoryId: foreignCategoryId, lineKey: 'invented_line' }] })
        .expect(400);
    });

    it('builds a draft with the home-office allowance and a completeness report', async () => {
      const draft = await as(
        owner,
        request(app.getHttpServer()).get(`/income-tax/returns/${taxYear}`),
      ).expect(200);

      expect(draft.body).toMatchObject({ status: 'draft', currency: 'EUR' });
      expect(draft.body.figures).toContainEqual(
        expect.objectContaining({ key: 'home_office', lineNo: '66', amount: 1260 }),
      );
      expect(draft.body.completeness.issues.map((i: { code: string }) => i.code)).toContain(
        'no_transactions',
      );
    });

    it('refuses to finalize or export before the disclaimer is accepted', async () => {
      await as(
        owner,
        request(app.getHttpServer()).post(`/income-tax/returns/${taxYear}/finalize`),
      ).expect(403);
      await as(
        owner,
        request(app.getHttpServer()).get(`/income-tax/returns/${taxYear}/export?format=pdf`),
      ).expect(403);
    });

    it('finalizes once, exports, and reopens', async () => {
      const status = await as(
        owner,
        request(app.getHttpServer()).post('/income-tax/disclaimer'),
      ).expect(201);
      expect(status.body).toMatchObject({ accepted: true });

      const finalized = await as(
        owner,
        request(app.getHttpServer()).post(`/income-tax/returns/${taxYear}/finalize`),
      ).expect(201);
      expect(finalized.body).toMatchObject({ status: 'finalized' });

      await as(
        owner,
        request(app.getHttpServer()).post(`/income-tax/returns/${taxYear}/finalize`),
      ).expect(409);

      const xlsx = await as(
        owner,
        request(app.getHttpServer()).get(`/income-tax/returns/${taxYear}/export?format=xlsx`),
      ).expect(200);
      expect(xlsx.headers['content-type']).toContain('spreadsheetml');

      const pdf = await as(
        owner,
        request(app.getHttpServer()).get(`/income-tax/returns/${taxYear}/export?format=pdf`),
      ).expect(200);
      expect(pdf.headers['content-type']).toContain('application/pdf');

      const reopened = await as(
        owner,
        request(app.getHttpServer()).post(`/income-tax/returns/${taxYear}/reopen`),
      ).expect(201);
      expect(reopened.body).toMatchObject({ status: 'draft' });
    });

    it('keeps one workspace’s draft out of another', async () => {
      const response = await as(
        stranger,
        request(app.getHttpServer()).get(`/income-tax/profile?taxYear=${taxYear}`),
      ).expect(200);
      expect(response.body).toMatchObject({ country: null, details: {} });

      // The owner's token pointed at the stranger's workspace is not a member there.
      const crossed = await request(app.getHttpServer())
        .get(`/income-tax/profile?taxYear=${taxYear}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .set('x-workspace-id', stranger.workspaceId);
      expect([403, 404]).toContain(crossed.status);
    });
  });

  describe('with Poland as the tax country', () => {
    let taxpayer: Session;

    beforeAll(async () => {
      taxpayer = await signUp(`income-tax-pl-${Date.now()}@example.com`);
      await as(taxpayer, request(app.getHttpServer()).put('/tax/settings/jurisdiction'))
        .send({ code: 'PL' })
        .expect(200);
    });

    it('picks the form by regime and reports the verified filing dates', async () => {
      const liniowy = await as(taxpayer, request(app.getHttpServer()).put('/income-tax/profile'))
        .send({ taxYear, taxpayerType: 'self_employed', details: { regime: 'liniowy' } })
        .expect(200);
      expect(liniowy.body).toMatchObject({
        pack: { formKey: 'pl-pit36l' },
        filingInfo: {
          formName: 'PIT-36L',
          filingOpens: '2026-02-15',
          deadlines: [{ kind: 'standard', date: '2026-04-30' }],
          authorityPreparation: 'prepared_needs_confirmation',
        },
      });

      const ryczalt = await as(taxpayer, request(app.getHttpServer()).put('/income-tax/profile'))
        .send({ taxYear, taxpayerType: 'self_employed', details: { regime: 'ryczalt' } })
        .expect(200);
      expect(ryczalt.body).toMatchObject({
        pack: { formKey: 'pl-pit28' },
        filingInfo: { formName: 'PIT-28' },
      });

      const draft = await as(
        taxpayer,
        request(app.getHttpServer()).get(`/income-tax/returns/${taxYear}`),
      ).expect(200);
      expect(draft.body).toMatchObject({
        currency: 'PLN',
        fxRule: 'nbp_previous_business_day',
        pack: { formKey: 'pl-pit28' },
      });
      expect(draft.body.figures.map((f: { key: string }) => f.key)).toContain(
        'revenue_after_reduction',
      );
    });
  });
});
