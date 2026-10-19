import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { accessTokenOf, deleteUserByEmail, e2eTestingModule } from './helpers/e2e-app';

/**
 * The welcome tutorial opens by itself only while `welcomeTutorialSeenAt` is
 * explicitly null on the client's copy of the user, so these cases follow that
 * field through every response a new account gets on its way in.
 */
describe('User welcome tutorial (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let userId: string;
  // Unique per run, and removed afterwards, so the suite can run again on the same database.
  const email = `welcome-tutorial-${Date.now()}@example.com`;

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
      email,
      password: 'Test123!@#',
      name: 'Tutorial Tester',
    });

    const login = await request(app.getHttpServer()).post('/auth/login').send({
      email,
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
    await deleteUserByEmail(dataSource, email);
    await app.close();
  });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).post('/users/me/welcome-tutorial').expect(401);
  });

  it('reports a fresh account as not having seen the tutorial', async () => {
    const response = await auth(request(app.getHttpServer()).get('/auth/me')).expect(200);

    expect(response.body).toHaveProperty('welcomeTutorialSeenAt', null);
  });

  it('keeps the field in the onboarding response the client switches to', async () => {
    const response = await auth(
      request(app.getHttpServer()).patch('/users/me/onboarding').send({ locale: 'en' }),
    ).expect(200);

    expect(response.body.user).toHaveProperty('welcomeTutorialSeenAt', null);
  });

  it('records when the tutorial was closed', async () => {
    const response = await auth(
      request(app.getHttpServer()).post('/users/me/welcome-tutorial'),
    ).expect(201);

    const [row] = await dataSource.query(
      `SELECT welcome_tutorial_seen_at FROM users WHERE id = $1`,
      [userId],
    );

    expect(row.welcome_tutorial_seen_at).not.toBeNull();
    expect(new Date(response.body.welcomeTutorialSeenAt).toISOString()).toBe(
      row.welcome_tutorial_seen_at.toISOString(),
    );
  });

  it('keeps the first timestamp when it is closed again', async () => {
    const [before] = await dataSource.query(
      `SELECT welcome_tutorial_seen_at FROM users WHERE id = $1`,
      [userId],
    );

    await auth(request(app.getHttpServer()).post('/users/me/welcome-tutorial')).expect(201);

    const [after] = await dataSource.query(
      `SELECT welcome_tutorial_seen_at FROM users WHERE id = $1`,
      [userId],
    );

    expect(after.welcome_tutorial_seen_at.toISOString()).toBe(
      before.welcome_tutorial_seen_at.toISOString(),
    );
  });
});
