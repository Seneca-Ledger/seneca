jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { Transaction } from '../../src/entities/transaction.entity';
import { User, UserRole } from '../../src/entities/user.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

/**
 * A read-only member reads; writing is for those the workspace lets write.
 *
 * Each route here once checked less than what it does: a viewer could
 * re-classify rows, rewrite the balance sheet, investments and metals; any
 * member with the statements toggle could send the workspace's events to an
 * outside URL; an API key with read scopes could import and undo; the person
 * who uploaded a file kept it after leaving; bulk delete skipped the trash.
 */
describe('Write permissions (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `perms-owner-${stamp}@example.com`,
    viewer: `perms-viewer-${stamp}@example.com`,
    member: `perms-member-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let viewer: E2eAccount;
  let member: E2eAccount;
  let categoryIds: string[];
  const fakeId = '00000000-0000-4000-8000-000000000000';

  const server = () => app.getHttpServer();
  /** Every request goes to the owner's workspace, whoever sends it. */
  const as = (account: E2eAccount, req: request.Test) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', owner.workspaceId);
  const withKey = (key: string, req: request.Test) => req.set('x-api-key', key);

  async function join(account: E2eAccount, role: string, permissions?: object): Promise<void> {
    const invite = await as(
      owner,
      request(server()).post(`/workspaces/${owner.workspaceId}/invitations`),
    )
      .send({ email: account.email, role, permissions })
      .expect(201);
    await request(server())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${account.token}`)
      .expect(200);
  }

  async function bookExpense(account: E2eAccount, merchant: string): Promise<string> {
    const statement = await as(account, request(server()).post('/statements/manual-expense'))
      .field('amount', '12.50')
      .field('currency', 'USD')
      .field('merchant', merchant)
      .field('categoryId', categoryIds[0])
      .field('date', '2026-05-01')
      .expect(201);
    return statement.body.id;
  }

  async function transactionOf(statementId: string): Promise<Transaction> {
    return dataSource.getRepository(Transaction).findOneByOrFail({ statementId });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Perms Owner');
    viewer = await registerAccount(app, emails.viewer, 'Perms Viewer');
    member = await registerAccount(app, emails.member, 'Perms Member');
    await join(viewer, 'viewer');
    await join(member, 'member', { canEditStatements: true });

    const categories = await as(owner, request(server()).get('/categories?type=expense')).expect(
      200,
    );
    categoryIds = categories.body.map((category: { id: string }) => category.id);
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  describe('a viewer is refused every write', () => {
    // Every row carries a body: jest hands a shorter row's missing argument `done`.
    const writes: Array<[string, 'post' | 'put' | 'patch' | 'delete', string, object]> = [
      ['classify one row', 'post', `/classification/transaction/${fakeId}`, {}],
      ['classify in bulk', 'post', '/classification/bulk', { transactionIds: [fakeId] }],
      ['balance snapshot', 'put', '/reports/balance/snapshot', { accountId: fakeId, amount: 1 }],
      ['balance account', 'post', '/reports/balance/accounts', { name: 'x', parentId: fakeId }],
      ['balance account delete', 'delete', `/reports/balance/accounts/${fakeId}`, {}],
      [
        'balance classification',
        'patch',
        `/reports/balance/accounts/${fakeId}/classification`,
        { riskLevel: 'high' },
      ],
      ['investment account', 'post', '/investments/accounts', { name: 'x' }],
      ['investment account delete', 'delete', `/investments/accounts/${fakeId}`, {}],
      ['holding', 'post', `/investments/accounts/${fakeId}/holdings`, { name: 'x', quantity: 1 }],
      ['holding edit', 'patch', `/investments/holdings/${fakeId}`, { quantity: 2 }],
      ['holding delete', 'delete', `/investments/holdings/${fakeId}`, {}],
      ['investment prices', 'post', '/investments/refresh-prices', {}],
      ['metal lot', 'post', '/metals/lots', { metal: 'XAU', quantity: 1, unitWeight: 1 }],
      ['metal lot edit', 'patch', `/metals/lots/${fakeId}`, { price: 0 }],
      ['metal lot delete', 'delete', `/metals/lots/${fakeId}`, {}],
      ['metal sale', 'post', `/metals/lots/${fakeId}/sell`, { quantity: 1, proceeds: 1 }],
      ['metal settings', 'patch', '/metals/settings', { dealerDiscount: {} }],
      ['metal photo delete', 'delete', `/metals/lots/${fakeId}/photo`, {}],
      ['metal prices', 'post', '/metals/refresh-prices', {}],
      ['peppol lookup', 'post', '/peppol/lookup', { peppolId: '0208:0428643097' }],
      ['workspace favourite', 'patch', '/workspaces/{ws}/favorite', {}],
    ];

    it.each(writes)('%s', async (_label, method, url, body) => {
      await as(viewer, request(server())[method](url.replace('{ws}', owner.workspaceId)))
        .send(body)
        .expect(403);
    });

    it('metal photo upload, before the file is stored', async () => {
      await as(viewer, request(server()).post(`/metals/lots/${fakeId}/photo`))
        .attach('photo', Buffer.from('not really a photo'), {
          filename: 'lot.png',
          contentType: 'image/png',
        })
        .expect(403);
    });

    it.each([
      '/integrations/simplefin/status',
      '/settings/email/smtp',
      '/settings/app',
    ])('reading the configuration at %s', async url => {
      await as(viewer, request(server()).get(url)).expect(403);
    });

    it('still sees whether Peppol is connected, which the invoice page needs', async () => {
      await as(viewer, request(server()).get('/integrations/peppol/status')).expect(200);
    });
  });

  describe('the owner still writes', () => {
    it('edits the balance sheet', async () => {
      // The tree is created on first read.
      await as(owner, request(server()).get('/reports/balance/accounts')).expect(200);
      const [section] = await dataSource.query(
        'SELECT id FROM balance_accounts WHERE workspace_id = $1 AND is_expandable = true LIMIT 1',
        [owner.workspaceId],
      );

      const account = await as(owner, request(server()).post('/reports/balance/accounts'))
        .send({ name: 'Car loan', parentId: section.id })
        .expect(201);
      await as(owner, request(server()).put('/reports/balance/snapshot'))
        .send({ accountId: account.body.id, amount: 1500 })
        .expect(200);
      await as(
        owner,
        request(server()).patch(`/reports/balance/accounts/${account.body.id}/classification`),
      )
        .send({ riskLevel: 'high' })
        .expect(200);
      await as(owner, request(server()).delete(`/reports/balance/accounts/${account.body.id}`)).expect(
        204,
      );
    });

    it('reads the configuration and stars the workspace', async () => {
      for (const url of ['/integrations/simplefin/status', '/settings/email/smtp', '/settings/app']) {
        await as(owner, request(server()).get(url)).expect(200);
      }
      const starred = await as(
        owner,
        request(server()).patch(`/workspaces/${owner.workspaceId}/favorite`),
      ).expect(200);
      expect(starred.body.isFavorite).toBe(true);
    });
  });

  describe('classification', () => {
    it('leaves a hand-picked category alone when one row is re-run', async () => {
      const statementId = await bookExpense(owner, `Picked shop ${stamp}`);
      const row = await transactionOf(statementId);
      await as(owner, request(server()).put(`/transactions/${row.id}`))
        .send({ categoryId: categoryIds[1] })
        .expect(200);
      // A rule that would say otherwise.
      await as(owner, request(server()).post('/categorization-rules'))
        .send({
          name: `Picked rule ${stamp}`,
          conditions: [{ field: 'counterparty_name', operator: 'contains', value: 'Picked shop' }],
          result: { categoryId: categoryIds[2] },
        })
        .expect(201);

      await as(owner, request(server()).post(`/classification/transaction/${row.id}`)).expect(200);

      const after = await transactionOf(statementId);
      expect(after.categoryId).toBe(categoryIds[1]);
      expect(after.categorySource).toBe('manual');
    });
  });

  describe('webhooks belong to those who manage integrations', () => {
    it('refuses a member with the statements toggle', async () => {
      await as(member, request(server()).post('/webhook-subscriptions'))
        .send({
          name: 'Exfil',
          url: 'https://example.com/hook',
          secret: 'member-secret-0123456789',
          events: ['transaction.created'],
        })
        .expect(403);
      await as(member, request(server()).post('/webhook-endpoints'))
        .send({ name: 'Back door' })
        .expect(403);
    });

    it('lets the owner mint an inbound endpoint', async () => {
      await as(owner, request(server()).post('/webhook-endpoints'))
        .send({ name: 'Scanner' })
        .expect(201);
    });
  });

  describe('API key scopes', () => {
    let readKey: string;
    let payablesKey: string;

    beforeAll(async () => {
      // Keys are made by an instance admin; the owner is one only for this step.
      await dataSource.getRepository(User).update({ id: owner.userId }, { role: UserRole.ADMIN });
      const scopes = await as(owner, request(server()).get('/api-keys/scopes')).expect(200);
      const read = await as(owner, request(server()).post('/api-keys'))
        .send({ name: 'Reader', scopes: scopes.body.presets.read })
        .expect(201);
      readKey = read.body.key;
      const write = await as(owner, request(server()).post('/api-keys'))
        .send({ name: 'Bills', scopes: ['payable.create', 'payable.view'] })
        .expect(201);
      payablesKey = write.body.key;
      await dataSource.getRepository(User).update({ id: owner.userId }, { role: UserRole.USER });
    });

    const payablesImport = {
      target: 'payables',
      mapping: { vendor: 0, amount: 1 },
      rows: [[`Electric ${Date.now()}`, '100']],
    };

    it('stops a read-only key from importing or undoing', async () => {
      await withKey(readKey, request(server()).post('/entity-imports'))
        .send(payablesImport)
        .expect(403);

      const imported = await withKey(payablesKey, request(server()).post('/entity-imports'))
        .send(payablesImport)
        .expect(201);
      expect(imported.body.counts.created).toBe(1);

      await withKey(readKey, request(server()).delete(`/entity-imports/${imported.body.batchId}`))
        .expect(403);
      await withKey(
        payablesKey,
        request(server()).delete(`/entity-imports/${imported.body.batchId}`),
      ).expect(200);
    });

    it('does not import statements with a payables key', async () => {
      await withKey(payablesKey, request(server()).post('/entity-imports'))
        .send({
          target: 'transactions',
          mapping: { date: 0, amount: 1, merchant: 2 },
          rows: [['2026-05-01', '-5', 'Kiosk']],
        })
        .expect(403);
    });

    it('searches only with the scopes to read what it finds', async () => {
      await withKey(readKey, request(server()).get('/search?q=Electric')).expect(200);
      await withKey(payablesKey, request(server()).get('/search?q=Electric')).expect(403);
    });
  });

  describe('storage', () => {
    it('drops the uploader once they leave the workspace', async () => {
      const leaver = await registerAccount(app, `perms-leaver-${stamp}@example.com`, 'Leaver');
      try {
        await join(leaver, 'member', { canEditStatements: true, canShareFiles: true });
        const statementId = await bookExpense(leaver, `Leaver shop ${stamp}`);
        await as(leaver, request(server()).get(`/storage/files/${statementId}`)).expect(200);

        await as(
          owner,
          request(server()).delete(`/workspaces/${owner.workspaceId}/members/${leaver.userId}`),
        ).expect(200);

        const asLeaver = (req: request.Test) => req.set('Authorization', `Bearer ${leaver.token}`);
        await asLeaver(request(server()).get(`/storage/files/${statementId}`)).expect(403);
        await asLeaver(request(server()).post(`/storage/files/${statementId}/share`))
          .send({ permission: 'view' })
          .expect(403);
        await asLeaver(request(server()).post(`/storage/files/${statementId}/trash`)).expect(403);
      } finally {
        await deleteUserByEmail(dataSource, leaver.email);
      }
    });

    it('bulk delete moves files to the trash and refuses a filed return', async () => {
      const plain = await bookExpense(owner, `Bulk plain ${stamp}`);
      const filed = await bookExpense(owner, `Bulk filed ${stamp}`);
      await dataSource.query('UPDATE transactions SET tax_locked = true, tax_amount = 0 WHERE statement_id = $1', [
        filed,
      ]);

      await as(owner, request(server()).post('/storage/files/bulk/delete'))
        .send({ statementIds: [plain, filed] })
        .expect(409);
      const [untouched] = await dataSource.query(
        'SELECT deleted_at FROM statements WHERE id = $1',
        [plain],
      );
      expect(untouched.deleted_at).toBeNull();

      const res = await as(owner, request(server()).post('/storage/files/bulk/delete'))
        .send({ statementIds: [plain] })
        .expect(201);
      expect(res.body).toEqual({ deleted: 1, missing: 0 });

      const [trashed] = await dataSource.query('SELECT deleted_at FROM statements WHERE id = $1', [
        plain,
      ]);
      expect(trashed.deleted_at).not.toBeNull();
      // Still restorable: the rows are there.
      await transactionOf(plain);
      const [audited] = await dataSource.query(
        "SELECT count(*)::int AS n FROM audit_events WHERE entity_id = $1 AND action = 'delete'",
        [plain],
      );
      expect(audited.n).toBe(1);
    });
  });
});
