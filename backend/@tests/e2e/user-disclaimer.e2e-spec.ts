import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { accessTokenOf, e2eTestingModule } from './helpers/e2e-app';
import { CURRENT_DISCLAIMER_VERSION } from '../../src/modules/users/disclaimer.constant';

/**
 * The disclaimer text lives in the client bundle; what has to be provable is
 * the record of what was accepted and when. These cases cover that record.
 */
describe('User disclaimer (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let userId: string;

  const auth = (req: request.Test) => req.set('Authorization', `Bearer ${accessToken}`);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    const register = await request(app.getHttpServer()).post('/auth/register').send({
      email: 'disclaimer-user@example.com',
      password: 'Test123!@#',
      name: 'Disclaimer Tester',
    });

    const login = await request(app.getHttpServer()).post('/auth/login').send({
      email: 'disclaimer-user@example.com',
      password: 'Test123!@#',
    });

    accessToken = accessTokenOf(login);
    userId = login.body?.user?.id;

    // Without this a broken fixture yields `Bearer undefined`, and assertions
    // that only read the database would still pass.
    if (!(accessToken && userId)) {
      throw new Error(
        `Auth setup failed. register ${register.status}: ${JSON.stringify(register.body)} | ` +
          `login ${login.status}: ${JSON.stringify(login.body)}`,
      );
    }
  });

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get('/users/me/disclaimer').expect(401);
    await request(app.getHttpServer()).post('/users/me/disclaimer').expect(401);
  });

  it('reports a fresh account as not having accepted', async () => {
    const response = await auth(request(app.getHttpServer()).get('/users/me/disclaimer')).expect(
      200,
    );

    expect(response.body).toMatchObject({
      version: CURRENT_DISCLAIMER_VERSION,
      accepted: false,
      acceptedAt: null,
      acceptedVersion: null,
    });
  });

  it('records the acceptance with the current version', async () => {
    await auth(request(app.getHttpServer()).post('/users/me/disclaimer')).expect(201);

    const [row] = await dataSource.query(
      `SELECT disclaimer_version, disclaimer_accepted_at FROM users WHERE id = $1`,
      [userId],
    );

    expect(row.disclaimer_version).toBe(CURRENT_DISCLAIMER_VERSION);
    expect(row.disclaimer_accepted_at).not.toBeNull();
  });

  it('reports the account as accepted afterwards', async () => {
    const response = await auth(request(app.getHttpServer()).get('/users/me/disclaimer')).expect(
      200,
    );

    expect(response.body.accepted).toBe(true);
    expect(response.body.acceptedVersion).toBe(CURRENT_DISCLAIMER_VERSION);
  });

  it('keeps the original timestamp when the same version is accepted again', async () => {
    const [before] = await dataSource.query(
      `SELECT disclaimer_accepted_at FROM users WHERE id = $1`,
      [userId],
    );

    await auth(request(app.getHttpServer()).post('/users/me/disclaimer')).expect(201);

    const [after] = await dataSource.query(
      `SELECT disclaimer_accepted_at FROM users WHERE id = $1`,
      [userId],
    );

    // The first acceptance is the one that carries meaning. Re-stamping it on
    // every page load would erase when consent was actually given.
    expect(after.disclaimer_accepted_at.toISOString()).toBe(
      before.disclaimer_accepted_at.toISOString(),
    );
  });

  it('re-prompts when the accepted version is superseded', async () => {
    // Simulates the text being reworded: the stored version no longer matches
    // the current one, so the gate must close again without a frontend release.
    await dataSource.query(`UPDATE users SET disclaimer_version = '1900-01-01' WHERE id = $1`, [
      userId,
    ]);

    const response = await auth(request(app.getHttpServer()).get('/users/me/disclaimer')).expect(
      200,
    );

    expect(response.body.accepted).toBe(false);
    expect(response.body.acceptedVersion).toBe('1900-01-01');
  });

  it('moves the timestamp forward when a superseded version is re-accepted', async () => {
    const [before] = await dataSource.query(
      `SELECT disclaimer_accepted_at FROM users WHERE id = $1`,
      [userId],
    );

    await auth(request(app.getHttpServer()).post('/users/me/disclaimer')).expect(201);

    const [after] = await dataSource.query(
      `SELECT disclaimer_version, disclaimer_accepted_at FROM users WHERE id = $1`,
      [userId],
    );

    expect(after.disclaimer_version).toBe(CURRENT_DISCLAIMER_VERSION);
    expect(after.disclaimer_accepted_at.getTime()).toBeGreaterThanOrEqual(
      before.disclaimer_accepted_at.getTime(),
    );
  });

  it('exposes the acceptance on the profile endpoint', async () => {
    const response = await auth(request(app.getHttpServer()).get('/users/me')).expect(200);

    expect(response.body.disclaimerVersion).toBe(CURRENT_DISCLAIMER_VERSION);
    expect(response.body.disclaimerAcceptedAt).not.toBeNull();
  });
});
