vi.mock('franc', () => ({
  franc: () => 'und',
}));

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
 * The local categorization model is read from the server's file system and its
 * model root is shared by every workspace: a workspace admin can neither point
 * it at another directory nor replace the shared model.
 */
describe('Local categorization settings (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `local-model-${Date.now()}@example.com`;
  let owner: E2eAccount;

  const as = (req: request.Test) =>
    req.set('Authorization', `Bearer ${owner.token}`).set('x-workspace-id', owner.workspaceId);
  const server = () => app.getHttpServer();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, email, 'Local Model Owner');
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('refuses a model path from the request', async () => {
    await as(request(server()).put('/settings/local-categorization'))
      .send({ enabled: true, localModelPath: '/etc' })
      .expect(400);
  });

  it('keeps a workspace owner who is not an instance admin from replacing the shared model', async () => {
    await as(request(server()).post('/settings/local-categorization/model'))
      .attach('model', Buffer.from('PK'), 'model.zip')
      .expect(403);
  });
});
