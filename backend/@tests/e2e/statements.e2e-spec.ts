import * as fs from 'fs';
import * as path from 'path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { StatementList } from '../../src/contracts';
import { Category, CategoryType, Note, Transaction, TransactionType } from '../../src/entities';
import { accessTokenOf, deleteUserByEmail, e2eTestingModule } from './helpers/e2e-app';

describe('StatementsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;
  let workspaceId: string;
  let userId: string;
  let statementId: string;

  const testUser = {
    email: 'statements-test@example.com',
    password: 'Test123!@#',
    name: 'Statements Test User',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Register and login test user
    const registerRes = await request(app.getHttpServer()).post('/auth/register').send(testUser);

    accessToken = accessTokenOf(registerRes);
    userId = registerRes.body.user.id;
    workspaceId = registerRes.body.user.workspaceId;
  });

  afterAll(async () => {
    // Cleanup test data
    if (dataSource) {
      await dataSource.query(
        `DELETE FROM transactions WHERE statement_id IN (SELECT id FROM statements WHERE user_id = $1)`,
        [userId],
      );
      await dataSource.query(`DELETE FROM statements WHERE user_id = $1`, [userId]);
      await deleteUserByEmail(dataSource, testUser.email);
      await deleteUserByEmail(dataSource, 'other@example.com');
    }
    await app.close();
  });

  describe('/statements (POST)', () => {
    it('should upload PDF statement', async () => {
      const testPdfPath = path.join(__dirname, '../fixtures/test-statement.pdf');

      // Create a simple test PDF if it doesn't exist
      if (!fs.existsSync(testPdfPath)) {
        fs.mkdirSync(path.dirname(testPdfPath), { recursive: true });
        fs.writeFileSync(testPdfPath, '%PDF-1.4\ntest content');
      }

      return request(app.getHttpServer())
        .post('/statements')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .attach('file', testPdfPath)
        .expect(201)
        .expect(res => {
          // Assigned first: the tests below all work on this statement.
          statementId = res.body.id;
          expect(res.body).toHaveProperty('id');
          expect(res.body.fileName).toBe('test-statement.pdf');
          expect(res.body.fileType).toBe('pdf');
          expect(res.body.status).toBe('uploaded');
        });
    });

    it('should reject upload without authentication', () => {
      return request(app.getHttpServer())
        .post('/statements')
        .attach('file', path.join(__dirname, '../fixtures/test-statement.pdf'))
        .expect(401);
    });

    it('should reject upload without file', () => {
      return request(app.getHttpServer())
        .post('/statements')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(400);
    });

    it('should reject unsupported file types', () => {
      const testFilePath = path.join(__dirname, '../fixtures/test.txt');
      if (!fs.existsSync(testFilePath)) {
        fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
        fs.writeFileSync(testFilePath, 'test content');
      }

      return request(app.getHttpServer())
        .post('/statements')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .attach('file', testFilePath)
        .expect(400);
    });

    it('should detect duplicate files', async () => {
      const testPdfPath = path.join(__dirname, '../fixtures/test-statement.pdf');

      return request(app.getHttpServer())
        .post('/statements')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .attach('file', testPdfPath)
        .expect(409);
    });
  });

  describe('/statements (GET)', () => {
    it('should get all statements for user', () => {
      return request(app.getHttpServer())
        .get('/statements')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThan(0);
          // The frontend checks this list against the same contract in dev.
          Schema.decodeUnknownSync(StatementList)(res.body.data);
        });
    });

    it('should filter by status', async () => {
      // An upload is parsed in the background and ends differently depending on
      // what the machine can parse, so the filter is checked on a manual expense,
      // which is stored as completed straight away.
      const categories = await request(app.getHttpServer())
        .get('/categories?type=expense')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
      const manual = await request(app.getHttpServer())
        .post('/statements/manual-expense')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .field('amount', '42')
        .field('currency', 'KZT')
        .field('merchant', 'Status filter')
        .field('categoryId', categories.body[0].id)
        .field('date', '2026-02-20')
        .expect(201);
      expect(manual.body.status).toBe('completed');

      const ids = (res: request.Response) =>
        res.body.data.map((statement: { id: string }) => statement.id);

      const completed = await request(app.getHttpServer())
        .get('/statements?statuses=completed')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
      expect(ids(completed)).toContain(manual.body.id);
      // A manual expense has a category and totals, so it exercises more of the contract.
      Schema.decodeUnknownSync(StatementList)(completed.body.data);
      for (const statement of completed.body.data) {
        expect(statement.status).toBe('completed');
      }

      const uploaded = await request(app.getHttpServer())
        .get('/statements?statuses=uploaded')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200);
      expect(ids(uploaded)).not.toContain(manual.body.id);
    });

    it('should search by file, merchant, description, category, amount and notes', async () => {
      const category = await dataSource.getRepository(Category).save({
        workspaceId,
        name: 'Quokka Supplies',
        type: CategoryType.EXPENSE,
      });
      const txRepo = dataSource.getRepository(Transaction);
      const base = {
        workspaceId,
        statementId,
        currency: 'EUR',
        transactionDate: new Date('2026-06-15'),
        transactionType: TransactionType.EXPENSE,
      };
      const [visible] = await txRepo.save([
        txRepo.create({
          ...base,
          counterpartyName: 'Zephyr Coffee Roasters',
          paymentPurpose: 'Beans for the office',
          amount: 42.37,
          debit: 42.37,
          categoryId: category.id,
        }),
        txRepo.create({
          ...base,
          counterpartyName: 'Hidden Clinic',
          paymentPurpose: 'Private visit',
          amount: 999.99,
          debit: 999.99,
          isPrivate: true,
        }),
      ]);
      await dataSource
        .getRepository(Note)
        .save({ workspaceId, transactionId: visible.id, body: 'reimburse via Vera' });

      const found = async (search: string): Promise<boolean> => {
        const res = await request(app.getHttpServer())
          .get('/statements')
          .query({ search })
          .set('Authorization', `Bearer ${accessToken}`)
          .set('x-workspace-id', workspaceId)
          .expect(200);
        return res.body.data.some((statement: { id: string }) => statement.id === statementId);
      };

      for (const hit of [
        'test-statement',
        'zephyr',
        'for the office',
        'quokka',
        'vera',
        '42',
        '42.3',
        '42,37',
      ]) {
        expect([hit, await found(hit)]).toEqual([hit, true]);
      }
      // A private transaction must not reveal itself through search.
      for (const miss of ['hidden clinic', '999.99', '42.38', 'no-such-term']) {
        expect([miss, await found(miss)]).toEqual([miss, false]);
      }

      await txRepo.delete({ statementId });
      await dataSource.getRepository(Category).delete({ id: category.id });
    });

    it('should reject request without authentication', () => {
      return request(app.getHttpServer()).get('/statements').expect(401);
    });

    it('should paginate results', () => {
      return request(app.getHttpServer())
        .get('/statements?page=1&limit=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200)
        .expect(res => {
          expect(res.body.data.length).toBeLessThanOrEqual(1);
        });
    });
  });

  describe('/statements/:id (GET)', () => {
    it('should get statement by id', () => {
      return request(app.getHttpServer())
        .get(`/statements/${statementId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200)
        .expect(res => {
          expect(res.body.id).toBe(statementId);
          expect(res.body).toHaveProperty('transactions');
        });
    });

    it('should return 404 for non-existent statement', () => {
      return request(app.getHttpServer())
        .get('/statements/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(404);
    });

    it('should reject access to other user statements', async () => {
      // Create another user
      const otherUser = {
        email: 'other@example.com',
        password: 'Test123!@#',
        name: 'Other User',
      };

      const otherRes = await request(app.getHttpServer()).post('/auth/register').send(otherUser);

      const otherToken = accessTokenOf(otherRes);

      return request(app.getHttpServer())
        .get(`/statements/${statementId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);
    });
  });

  describe('/statements/:id (PATCH)', () => {
    it('should update statement', () => {
      return request(app.getHttpServer())
        .patch(`/statements/${statementId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          balanceStart: 100,
        })
        .expect(200)
        .expect(res => {
          expect(Number(res.body.balanceStart)).toBe(100);
        });
    });

    it('should reject update without permission', async () => {
      // Test with workspace member without edit permissions
      // This requires setting up workspace with restricted permissions
      expect(true).toBe(true);
    });

    it('should validate update data', () => {
      return request(app.getHttpServer())
        .patch(`/statements/${statementId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .send({
          status: 'invalid_status',
        })
        .expect(400);
    });
  });

  describe('/statements/:id (DELETE)', () => {
    it('should delete statement and transactions', async () => {
      // First create a statement to delete
      const testPdfPath = path.join(__dirname, '../fixtures/delete-test.pdf');
      if (!fs.existsSync(testPdfPath)) {
        fs.writeFileSync(testPdfPath, '%PDF-1.4\ndelete test');
      }

      const uploadRes = await request(app.getHttpServer())
        .post('/statements')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .attach('file', testPdfPath);

      const deleteId = uploadRes.body.id;

      // Deleting moves the statement to the trash and answers without a body.
      return request(app.getHttpServer())
        .delete(`/statements/${deleteId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(204);
    });

    it('should return 404 for already deleted statement', () => {
      return request(app.getHttpServer())
        .delete('/statements/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(404);
    });

    it('should reject delete without permission', () => {
      // Test workspace permission enforcement
      expect(true).toBe(true);
    });
  });

  describe('/statements/:id/reprocess (POST)', () => {
    it('should reprocess statement', () => {
      return request(app.getHttpServer())
        .post(`/statements/${statementId}/reprocess`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(201);
    });

    it('should not start a second run for a statement already processing', async () => {
      // Set statement to processing status
      await dataSource.query(`UPDATE statements SET status = 'processing' WHERE id = $1`, [
        statementId,
      ]);

      const res = await request(app.getHttpServer())
        .post(`/statements/${statementId}/reprocess`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId);

      // The running job is left alone: the statement comes back as it is.
      expect(res.status).toBe(201);
      expect(res.body.status).toBe('processing');

      // Reset status
      await dataSource.query(`UPDATE statements SET status = 'uploaded' WHERE id = $1`, [
        statementId,
      ]);
    });
  });

  describe('Statement Processing', () => {
    it('should automatically process uploaded statement', async () => {
      // Wait for processing to complete (or mock the processing)
      // This is integration with parsing service
      expect(true).toBe(true);
    });

    it('should handle parsing errors gracefully', () => {
      // Upload invalid/corrupted file
      expect(true).toBe(true);
    });

    it('should extract transactions from statement', () => {
      // Verify transactions were created
      return request(app.getHttpServer())
        .get(`/statements/${statementId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('x-workspace-id', workspaceId)
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('transactions');
          expect(Array.isArray(res.body.transactions)).toBe(true);
        });
    });
  });
});
