jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A category the user picks by hand is recorded as such, survives a bulk
 * re-classification, and the workspace switches round-trip through the API.
 *
 * Plus the two claims about the payee model that only real SQL can settle: the
 * payee key is derived on insert whichever path books the row, and the history
 * reads confirmed rows only.
 */
describe('Category source (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const email = `category-source-${Date.now()}@example.com`;
  let owner: E2eAccount;
  let transactionId: string;
  let categoryIds: string[];

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

    owner = await registerAccount(app, email, 'Category Source Owner');
    const categories = await as(request(server()).get('/categories?type=expense')).expect(200);
    categoryIds = categories.body.map((category: { id: string }) => category.id);

    const statement = await as(request(server()).post('/statements/manual-expense'))
      .field('amount', '42')
      .field('currency', 'KZT')
      .field('merchant', 'Corner shop')
      .field('categoryId', categoryIds[0])
      .field('date', '2026-05-01')
      .expect(201);
    const listed = await as(
      request(server()).get(`/transactions?statementId=${statement.body.id}`),
    ).expect(200);
    transactionId = listed.body.data[0].id;
  });

  afterAll(async () => {
    if (dataSource) {
      await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('records a hand-picked category as manual', async () => {
    const res = await as(request(server()).put(`/transactions/${transactionId}`))
      .send({ categoryId: categoryIds[1] })
      .expect(200);
    expect(res.body).toMatchObject({ categoryId: categoryIds[1], categorySource: 'manual' });

    const row = await dataSource.getRepository(Transaction).findOneByOrFail({ id: transactionId });
    expect(row.categoryId).toBe(categoryIds[1]);
    expect(row.categorySource).toBe('manual');
    expect(row.categoryReason).toBeNull();
  });

  it('keeps the manual pick through a bulk re-classification', async () => {
    const res = await as(request(server()).post('/classification/bulk'))
      .send({ transactionIds: [transactionId] })
      .expect(200);
    expect(res.body).toMatchObject({ total: 1, keptManual: 1, successful: 0 });

    const row = await dataSource.getRepository(Transaction).findOneByOrFail({ id: transactionId });
    expect(row.categoryId).toBe(categoryIds[1]);
    expect(row.categorySource).toBe('manual');
  });

  it('round-trips the processing switches', async () => {
    await as(request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ processing: { aiCategorization: false, merchantLearning: false } })
      .expect(200);

    const workspace = await as(request(server()).get(`/workspaces/${owner.workspaceId}`)).expect(
      200,
    );
    expect(workspace.body.settings.processing).toMatchObject({
      aiCategorization: false,
      aiMerchantNormalization: true,
      merchantLearning: false,
    });

    await as(request(server()).patch(`/workspaces/${owner.workspaceId}`))
      .send({ processing: { aiCategorization: 'no' } })
      .expect(400);
  });

  // Its own workspace: the switches test above leaves merchantLearning off, and
  // the service caches that answer for a minute.
  describe('categorising from the payee history', () => {
    const payeeEmail = `payee-history-${Date.now()}@example.com`;
    let payeeOwner: E2eAccount;
    let payeeCategoryIds: string[];

    const asPayee = (req: request.Test) =>
      req
        .set('Authorization', `Bearer ${payeeOwner.token}`)
        .set('x-workspace-id', payeeOwner.workspaceId);

    beforeAll(async () => {
      payeeOwner = await registerAccount(app, payeeEmail, 'Payee History Owner');
      const categories = await asPayee(request(server()).get('/categories?type=expense')).expect(
        200,
      );
      payeeCategoryIds = categories.body.map((category: { id: string }) => category.id);
    });

    afterAll(async () => {
      if (dataSource) {
        await deleteUserByEmail(dataSource, payeeEmail);
      }
    });

    const book = async (counterpartyName: string, fields: Partial<Transaction>) =>
      dataSource.getRepository(Transaction).save(
        dataSource.getRepository(Transaction).create({
          workspaceId: payeeOwner.workspaceId,
          transactionDate: new Date('2026-05-02'),
          counterpartyName,
          paymentPurpose: counterpartyName,
          debit: 10,
          amount: 10,
          currency: 'KZT',
          transactionType: TransactionType.EXPENSE,
          isVerified: false,
          ...fields,
        }),
      );

    const classify = async (id: string) => {
      await asPayee(request(server()).post(`/classification/transaction/${id}`)).expect(200);
      return dataSource.getRepository(Transaction).findOneByOrFail({ id });
    };

    it('derives the payee key on insert, whichever path books the row', async () => {
      const row = await book('SQ *BLUE BOTTLE COFFEE 8821 OAKLAND CA', {});

      const stored = await dataSource.getRepository(Transaction).findOneByOrFail({ id: row.id });

      expect(stored.payeeKey).toBe('blue bottle coffee oakland ca');
    });

    it('files a new row the way the payee was filed before', async () => {
      for (const terminal of ['1111', '2222', '3333']) {
        await book(`REWE SAGT DANKE ${terminal} //ALMATY/KZ`, {
          categoryId: payeeCategoryIds[2],
          isVerified: true,
        });
      }
      const fresh = await book('REWE SAGT DANKE 4444 //ALMATY/KZ', {});

      const classified = await classify(fresh.id);

      expect(classified.categoryId).toBe(payeeCategoryIds[2]);
      expect(classified.categorySource).toBe('history');
    });

    it('does not learn from rows nobody has confirmed', async () => {
      for (const terminal of ['5555', '6666', '7777']) {
        await book(`MAGNUM CASH AND CARRY ${terminal}`, {
          categoryId: payeeCategoryIds[3],
          isVerified: false,
        });
      }
      const fresh = await book('MAGNUM CASH AND CARRY 8888', {});

      const classified = await classify(fresh.id);

      expect(classified.categorySource).toBe('default');
    });

    it('obeys a standing instruction for one payee', async () => {
      for (const terminal of ['1212', '1313', '1414']) {
        await book(`SMALL BAKERY ${terminal}`, {
          categoryId: payeeCategoryIds[2],
          isVerified: true,
        });
      }
      await dataSource.query(
        `INSERT INTO payee_overrides (workspace_id, payee_key, mode) VALUES ($1, $2, 'never')`,
        [payeeOwner.workspaceId, 'small bakery'],
      );
      const fresh = await book('SMALL BAKERY 1515', {});

      const classified = await classify(fresh.id);

      expect(classified.categorySource).toBe('default');
    });
  });
});
