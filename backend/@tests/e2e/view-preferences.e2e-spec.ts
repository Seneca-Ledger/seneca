import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A page remembering how one person left it.
 *
 * Per person, not per workspace alone: two people sharing a household each keep
 * their own filter, which is the whole point — otherwise filtering down to your
 * own spending would change what your partner sees.
 */
describe('View preferences (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `view-owner-${stamp}@example.com`,
    partner: `view-partner-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let partner: E2eAccount;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'View Owner');
    partner = await registerAccount(app, emails.partner, 'View Partner');

    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: partner.email, role: 'member' })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${partner.token}`)
      .expect(200);
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('starts with nothing remembered', async () => {
    const res = await as(owner, request(server()).get('/view-preferences/transactions')).expect(
      200,
    );
    expect(res.body.state).toBeNull();
  });

  it('gives back what was saved', async () => {
    await as(owner, request(server()).put('/view-preferences/transactions'))
      .send({ state: { owner: 'me', currency: 'EUR' } })
      .expect(200);

    const res = await as(owner, request(server()).get('/view-preferences/transactions')).expect(
      200,
    );
    expect(res.body.state).toEqual({ owner: 'me', currency: 'EUR' });
  });

  it('replaces rather than piling up rows', async () => {
    await as(owner, request(server()).put('/view-preferences/transactions'))
      .send({ state: { owner: 'shared' } })
      .expect(200);

    const res = await as(owner, request(server()).get('/view-preferences/transactions')).expect(
      200,
    );
    expect(res.body.state).toEqual({ owner: 'shared' });

    const rows = await dataSource.query(
      'SELECT count(*)::int AS count FROM view_preferences WHERE user_id = $1 AND scope = $2',
      [owner.userId, 'transactions'],
    );
    expect(rows[0].count).toBe(1);
  });

  it('keeps each person’s view to themselves', async () => {
    await as(partner, request(server()).put('/view-preferences/transactions'))
      .send({ state: { owner: 'me' } })
      .expect(200);

    const mine = await as(owner, request(server()).get('/view-preferences/transactions')).expect(
      200,
    );
    expect(mine.body.state).toEqual({ owner: 'shared' });
  });

  it('keeps each page separate', async () => {
    const review = await as(owner, request(server()).get('/view-preferences/review')).expect(200);
    expect(review.body.state).toBeNull();
  });

  it('refuses a page it does not know', () => {
    return as(owner, request(server()).get('/view-preferences/whatever')).expect(400);
  });
});
