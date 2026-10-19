import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { User, UserRole } from '../../src/entities/user.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * `PUT /users/:id` edits the profile. The e-mail address is not part of it:
 * it changes only through `PATCH /users/me/email` and the link sent to the
 * new address, or anyone could take an address they cannot read.
 */
describe('Users (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    user: `users-user-${stamp}@example.com`,
    admin: `users-admin-${stamp}@example.com`,
    taken: `users-taken-${stamp}@example.com`,
  };
  let user: E2eAccount;
  let admin: E2eAccount;

  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    user = await registerAccount(app, emails.user, 'Plain User');
    admin = await registerAccount(app, emails.admin, 'Instance Admin');
    await dataSource.getRepository(User).update({ email: emails.admin }, { role: UserRole.ADMIN });
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  it('lets a user rename themselves', async () => {
    await as(user, request(server()).put(`/users/${user.userId}`))
      .send({ name: 'Renamed User' })
      .expect(200);

    const me = await as(user, request(server()).get('/users/me')).expect(200);
    expect(me.body.name).toBe('Renamed User');
  });

  it('refuses an e-mail change without the confirmation link', async () => {
    await as(user, request(server()).put(`/users/${user.userId}`))
      .send({ email: emails.taken })
      .expect(400);

    const me = await as(user, request(server()).get('/users/me')).expect(200);
    expect(me.body.email).toBe(emails.user);
  });

  it('refuses it to an instance admin as well', async () => {
    await as(admin, request(server()).put(`/users/${user.userId}`))
      .send({ email: emails.taken })
      .expect(400);

    const stored = await dataSource.getRepository(User).findOneByOrFail({ id: user.userId });
    expect(stored.email).toBe(emails.user);
  });
});
