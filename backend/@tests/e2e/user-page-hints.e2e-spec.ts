import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { PAGE_HINTS_MAX_KEYS } from '../../src/modules/users/users.service';
import { accessTokenOf, deleteUserByEmail, e2eTestingModule } from './helpers/e2e-app';

/**
 * A page shows the hint steps newer than the version stored for it, so the
 * stored version may only go up, and a reset brings every page's hints back.
 */
describe('User page hints (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let userId: string;
  // Unique per run, and removed afterwards, so the suite can run again on the same database.
  const email = `page-hints-${Date.now()}@example.com`;

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${accessToken}`);
  const mark = (body: unknown) =>
    auth(request(app.getHttpServer()).post('/users/me/page-hints').send(body as object));
  const stored = async (): Promise<Record<string, number>> => {
    const [row] = await dataSource.query(`SELECT page_hints_seen FROM users WHERE id = $1`, [
      userId,
    ]);
    return row.page_hints_seen;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    const register = await request(app.getHttpServer()).post('/auth/register').send({
      email,
      password: 'Test123!@#',
      name: 'Hints Tester',
    });

    const login = await request(app.getHttpServer()).post('/auth/login').send({
      email,
      password: 'Test123!@#',
    });

    accessToken = accessTokenOf(login);
    userId = login.body?.user?.id;

    if (!(accessToken && userId)) {
      throw new Error(
        `Auth setup failed. register ${register.status}: ${JSON.stringify(register.body)} | ` +
          `login ${login.status}: ${JSON.stringify(login.body)}`,
      );
    }
  });

  afterAll(async () => {
    await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .post('/users/me/page-hints')
      .send({ page: 'budgets', version: 1 })
      .expect(401);
    await request(app.getHttpServer()).delete('/users/me/page-hints').expect(401);
  });

  it('reports a fresh account as having seen no hints', async () => {
    const response = await auth(request(app.getHttpServer()).get('/auth/me')).expect(200);

    expect(response.body).toHaveProperty('pageHintsSeen', {});
  });

  it('keeps the map in the onboarding response the client switches to', async () => {
    const response = await auth(
      request(app.getHttpServer()).patch('/users/me/onboarding').send({ locale: 'en' }),
    ).expect(200);

    expect(response.body.user).toHaveProperty('pageHintsSeen', {});
  });

  it('stores the version per page and answers the whole map', async () => {
    const response = await mark({ page: 'budgets', version: 2 }).expect(201);
    await mark({ page: 'dashboard', version: 1 }).expect(201);

    expect(response.body).toEqual({ pageHintsSeen: { budgets: 2 } });
    expect(await stored()).toEqual({ budgets: 2, dashboard: 1 });
  });

  it('never lowers a stored version', async () => {
    const response = await mark({ page: 'budgets', version: 1 }).expect(201);

    expect(response.body.pageHintsSeen.budgets).toBe(2);
    await mark({ page: 'budgets', version: 3 }).expect(201);
    expect((await stored()).budgets).toBe(3);
  });

  it('shows the map in the profile', async () => {
    const response = await auth(request(app.getHttpServer()).get('/auth/me')).expect(200);

    expect(response.body.pageHintsSeen).toEqual({ budgets: 3, dashboard: 1 });
  });

  it.each([
    [{ page: 'Budgets', version: 1 }],
    [{ page: '1budgets', version: 1 }],
    [{ page: 'budgets-page', version: 1 }],
    [{ page: `a${'b'.repeat(40)}`, version: 1 }],
    [{ page: 'budgets', version: 0 }],
    [{ page: 'budgets', version: 1001 }],
    [{ page: 'budgets', version: 1.5 }],
    [{ page: 'budgets', version: '2' }],
    [{ page: 'budgets' }],
    [{ page: 'budgets', version: 1, extra: true }],
  ])('refuses %j', async body => {
    await mark(body).expect(400);
  });

  it(`refuses a new page once ${PAGE_HINTS_MAX_KEYS} are stored, but still raises a known one`, async () => {
    const full = Object.fromEntries(
      Array.from({ length: PAGE_HINTS_MAX_KEYS }, (_, index) => [`page${index}`, 1]),
    );
    await dataSource.query(`UPDATE users SET page_hints_seen = $2::jsonb WHERE id = $1`, [
      userId,
      JSON.stringify(full),
    ]);

    const refused = await mark({ page: 'onemore', version: 1 }).expect(201);
    expect(refused.body.pageHintsSeen).not.toHaveProperty('onemore');
    expect(Object.keys(await stored())).toHaveLength(PAGE_HINTS_MAX_KEYS);

    await mark({ page: 'page7', version: 4 }).expect(201);
    expect((await stored()).page7).toBe(4);
  });

  it('brings every hint back on reset', async () => {
    const response = await auth(request(app.getHttpServer()).delete('/users/me/page-hints')).expect(
      200,
    );

    expect(response.body).toEqual({ pageHintsSeen: {} });
    expect(await stored()).toEqual({});
  });
});
