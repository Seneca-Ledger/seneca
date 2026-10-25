vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { createHash } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Schema } from 'effect';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import {
  BranchItem,
  CategoryItem,
  MessageResult,
  PayeeMerge,
  PayeeRecord,
  SharedLinkItem,
  StorageFolder,
  StorageTag,
  StorageViewItem,
  TransactionAttachment,
  WalletItem,
} from '../../src/contracts';
import {
  BulkFileDownloads,
  BulkFilesDeleted,
  BulkFilesRestored,
  CreatedSharedLink,
  FileDeleted,
  FileFolderMove,
  FilePermissionList,
  FilePermissionRecord,
  FileRestored,
  FileTagsUpdate,
  FileTrashed,
  FileUntrashed,
  FileVersionItem,
  FileVersionList,
  FolderDeleted,
  SharedLinkList,
  ViewDeleted,
} from '../../src/contracts/storage/storage-actions';
import {
  DuplicatesMerged,
  DuplicateUnmarked,
  PairUnlinked,
  ReimbursementLinked,
  TransactionRecord,
  TransactionRecordList,
  TransferLinked,
  TransfersDetected,
} from '../../src/contracts/transactions/transaction-record';
import { Transaction, TransactionType } from '../../src/entities/transaction.entity';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

/**
 * Storage, transactions, categories, branches, wallets and payees: every
 * answer checked against its contract, with data in it. A private row stays
 * redacted on every path that answers rows.
 */
describe('API contracts: ledger book (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `contracts-ledgerbook-owner-${stamp}@example.com`,
    member: `contracts-ledgerbook-member-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let member: E2eAccount;
  let categoryId: string;

  const call = (method: Method, url: string, body?: object, as: E2eAccount = owner) => {
    const req = request(app.getHttpServer())
      [method](url)
      .set('Authorization', `Bearer ${as.token}`)
      .set('x-workspace-id', owner.workspaceId);
    return body ? req.send(body) : req;
  };
  const matches = (schema: Schema.Top, body: unknown) =>
    Schema.decodeUnknownSync(schema as Schema.Codec<unknown, unknown>, {
      onExcessProperty: 'ignore',
    })(body);

  /** A manual expense: its statement and its one transaction. */
  const bookExpense = async (merchant: string, amount: string) => {
    const statement = await call('post', '/statements/manual-expense')
      .field('amount', amount)
      .field('currency', 'EUR')
      .field('merchant', merchant)
      .field('categoryId', categoryId)
      .field('date', '2026-10-01')
      .expect(201);
    const rows = await call('get', `/transactions?statementId=${statement.body.id}`).expect(200);
    return { statementId: statement.body.id as string, transactionId: rows.body.data[0].id as string };
  };

  /** A copy of a row saved straight to the database: what an import would add. */
  const cloneRow = async (sourceId: string, overrides: Partial<Transaction>) => {
    const repository = dataSource.getRepository(Transaction);
    const { id: _id, createdAt: _c, updatedAt: _u, fingerprint: _f, ...row } =
      await repository.findOneByOrFail({ id: sourceId });
    return (await repository.save({ ...row, ...overrides })).id;
  };

  beforeAll(async () => {
    const moduleFixture = await e2eTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    owner = await registerAccount(app, emails.owner, 'Member One');
    member = await registerAccount(app, emails.member, 'Member Two');
    const invite = await call('post', `/workspaces/${owner.workspaceId}/invitations`, {
      email: member.email,
      role: 'member',
      permissions: { canEditStatements: true },
    }).expect(201);
    await request(app.getHttpServer())
      .post(`/workspaces/invitations/${invite.body.invitation.token}/accept`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(200);
    categoryId = (await call('get', '/categories?type=expense').expect(200)).body[0].id;
  });

  afterAll(async () => {
    if (dataSource) {
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  describe('branches, wallets and categories', () => {
    it('create, read, update and delete a branch', async () => {
      const created = await call('post', '/branches', { name: 'Main office' }).expect(201);
      matches(BranchItem, created.body);
      expect(created.body.code).toBeNull();
      const id = created.body.id;
      matches(BranchItem, (await call('get', `/branches/${id}`).expect(200)).body);
      const updated = await call('put', `/branches/${id}`, { code: 'HQ' }).expect(200);
      matches(BranchItem, updated.body);
      expect(updated.body.code).toBe('HQ');
      matches(MessageResult, (await call('delete', `/branches/${id}`).expect(200)).body);
    });

    it('create, read, update and delete a wallet, its balance as stored', async () => {
      const created = await call('post', '/wallets', {
        name: 'Cash box',
        currency: 'EUR',
        initialBalance: 12.5,
      }).expect(201);
      matches(WalletItem, created.body);
      expect(created.body.initialBalance).toBe('12.50');
      const id = created.body.id;
      matches(WalletItem, (await call('get', `/wallets/${id}`).expect(200)).body);
      const updated = await call('put', `/wallets/${id}`, { initialBalance: 20 }).expect(200);
      matches(WalletItem, updated.body);
      expect(updated.body.initialBalance).toBe('20.00');
      matches(MessageResult, (await call('delete', `/wallets/${id}`).expect(200)).body);
    });

    it('create, read, update and delete a category, with its parent', async () => {
      const created = await call('post', '/categories', {
        name: 'Garden tools',
        type: 'expense',
        parentId: categoryId,
      }).expect(201);
      matches(CategoryItem, created.body);
      expect(created.body.parent.id).toBe(categoryId);
      const id = created.body.id;
      matches(CategoryItem, (await call('get', `/categories/${id}`).expect(200)).body);
      const updated = await call('put', `/categories/${id}`, { color: '#22c55e' }).expect(200);
      matches(CategoryItem, updated.body);
      expect(updated.body.color).toBe('#22c55e');
      matches(MessageResult, (await call('delete', `/categories/${id}`).expect(200)).body);
    });
  });

  describe('payees', () => {
    it('re-checks a VAT number and merges two payees', async () => {
      await bookExpense('ACME Store - Wireless Buds', '19.90');
      await bookExpense('ACME Shop - Garden Hose', '9.90');
      const payees = (await call('get', '/payees').expect(200)).body.data;
      const target = payees.find((p: { name: string }) => p.name.startsWith('ACME Store'));
      const source = payees.find((p: { name: string }) => p.name.startsWith('ACME Shop'));
      await call('patch', `/payees/${target.id}`, { countryCode: 'DE', vatId: 'DE123456789' }).expect(
        200,
      );
      const checked = await call('post', `/payees/${target.id}/vat-check`, {}).expect(201);
      matches(PayeeRecord, checked.body);
      expect(checked.body.vatId).toBe('DE123456789');
      const merged = await call('post', `/payees/${target.id}/merge`, {
        sourceIds: [source.id],
      }).expect(201);
      matches(PayeeMerge, merged.body);
      expect(merged.body.merged).toBe(1);
    });
  });

  describe('transactions', () => {
    let transactionId: string;
    let ownerMemberId: string;

    beforeAll(async () => {
      ({ transactionId } = await bookExpense('Example Bakery - Rye Loaf', '42.50'));
      const [row] = await dataSource.query(
        'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [owner.workspaceId, owner.userId],
      );
      ownerMemberId = row.id;
    });

    it('GET and PUT /transactions/:id answer the row as stored', async () => {
      const one = await call('get', `/transactions/${transactionId}`).expect(200);
      matches(TransactionRecord, one.body);
      expect(one.body.payee).not.toBeNull();
      const updated = await call('put', `/transactions/${transactionId}`, {
        comments: 'For the office',
        debit: 42.5,
      }).expect(200);
      matches(TransactionRecord, updated.body);
      expect(updated.body.debit).toBe('42.50');
      const bulk = await call('post', '/transactions/bulk-update', {
        items: [{ id: transactionId, updates: { comments: 'Checked' } }],
      }).expect(200);
      matches(TransactionRecordList, bulk.body);
      expect(bulk.body[0].comments).toBe('Checked');
    });

    it('split, its parts and unsplit', async () => {
      const id = await cloneRow(transactionId, { counterpartyName: 'Example Market - Groceries' });
      const parts = await call('post', `/transactions/${id}/split`, {
        parts: [{ amount: 20 }, { amount: 22.5 }],
      }).expect(200);
      matches(TransactionRecordList, parts.body);
      expect(parts.body).toHaveLength(2);
      expect(parts.body[1].amount).toBe('22.50');
      const listed = await call('get', `/transactions/${id}/split`).expect(200);
      matches(TransactionRecordList, listed.body);
      const merged = await call('post', `/transactions/${id}/unsplit`).expect(200);
      matches(TransactionRecord, merged.body);
      expect(merged.body.splitGroupId).toBeNull();
    });

    it('merge duplicates and unmark one', async () => {
      const copy = await cloneRow(transactionId, {});
      const merged = await call('post', '/transactions/duplicates/merge', {
        transactionIds: [transactionId, copy],
      }).expect(200);
      matches(DuplicatesMerged, merged.body);
      const unmarked = await call('post', `/transactions/${copy}/unmark-duplicate`).expect(200);
      matches(DuplicateUnmarked, unmarked.body);
      expect(unmarked.body.transaction.isDuplicate).toBe(false);
    });

    it('detect, link and unlink transfers and reimbursements', async () => {
      matches(TransfersDetected, (await call('post', '/transactions/transfers/detect', {}).expect(200)).body);
      const expense = await cloneRow(transactionId, { counterpartyName: 'Own account' });
      const income = await cloneRow(transactionId, {
        transactionType: TransactionType.INCOME,
        debit: null,
        credit: 42.5,
        counterpartyName: 'Own account',
      });
      const linked = await call('post', `/transactions/${income}/link-transfer`, {
        otherId: expense,
      }).expect(200);
      matches(TransferLinked, linked.body);
      matches(PairUnlinked, (await call('post', `/transactions/${income}/unlink-transfer`).expect(200)).body);
      const refund = await call('post', `/transactions/${income}/link-reimbursement`, {
        expenseId: expense,
      }).expect(200);
      matches(ReimbursementLinked, refund.body);
      expect(refund.body.full).toBe(true);
      matches(
        PairUnlinked,
        (await call('post', `/transactions/${income}/unlink-reimbursement`).expect(200)).body,
      );
    });

    it('uploads and removes an attachment', async () => {
      const uploaded = await call('post', `/transactions/${transactionId}/attachments`)
        .attach('file', Buffer.from('%PDF-1.4 ledger'), {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
        })
        .expect(201);
      matches(TransactionAttachment, uploaded.body);
      expect(uploaded.body).not.toHaveProperty('storedFileName');
      matches(
        MessageResult,
        (await call('delete', `/transactions/attachments/${uploaded.body.id}`).expect(200)).body,
      );
    });

    it('keeps a private row redacted for another member on every row answer', async () => {
      const id = await cloneRow(transactionId, { counterpartyName: 'Example Jeweller - Ring' });
      await call('put', `/transactions/${id}`, { ownerMemberId }).expect(200);
      const own = await call('put', `/transactions/${id}`, { isPrivate: true }).expect(200);
      expect(own.body.counterpartyName).toBe('Example Jeweller - Ring');

      const redacted = (body: { counterpartyName: string; payee: unknown; payeeId: unknown }) => {
        expect(body.counterpartyName).toBe('—');
        expect(body.payee).toBeNull();
        expect(body.payeeId).toBeNull();
      };
      const one = await call('get', `/transactions/${id}`, undefined, member).expect(200);
      matches(TransactionRecord, one.body);
      redacted(one.body);
      const parts = await call('get', `/transactions/${id}/split`, undefined, member).expect(200);
      redacted(parts.body[0]);
      const edited = await call('put', `/transactions/${id}`, { comments: 'Seen' }, member).expect(200);
      redacted(edited.body);
      const bulk = await call(
        'post',
        '/transactions/bulk-update',
        { items: [{ id, updates: { comments: 'Seen twice' } }] },
        member,
      ).expect(200);
      redacted(bulk.body[0]);
    });
  });

  describe('storage', () => {
    let statementId: string;
    const fileBytes = Buffer.from('date,amount\n2026-10-01,42.50\n');

    beforeAll(async () => {
      ({ statementId } = await bookExpense('Example Books - Atlas', '31.00'));
      // A file the versions and the restore can read.
      await dataSource.query('UPDATE statements SET file_data = $1, file_hash = $2 WHERE id = $3', [
        fileBytes,
        createHash('sha256').update(fileBytes).digest('hex'),
        statementId,
      ]);
    });

    it('tags, folders and views of a file', async () => {
      const tag = await call('post', '/storage/tags', { name: 'Receipts' }).expect(201);
      matches(StorageTag, tag.body);
      const tagged = await call('patch', `/storage/files/${statementId}/tags`, {
        tagIds: [tag.body.id],
      }).expect(200);
      matches(FileTagsUpdate, tagged.body);
      expect(tagged.body.tags).toHaveLength(1);
      const folder = await call('post', '/storage/folders', { name: 'Books' }).expect(201);
      matches(StorageFolder, folder.body);
      const moved = await call('patch', `/storage/files/${statementId}/folder`, {
        folderId: folder.body.id,
      }).expect(200);
      matches(FileFolderMove, moved.body);
      expect(moved.body.folderId).toBe(folder.body.id);
      const dropped = await call('delete', `/storage/folders/${folder.body.id}`).expect(200);
      matches(FolderDeleted, dropped.body);
      matches(MessageResult, (await call('delete', `/storage/tags/${tag.body.id}`).expect(200)).body);
      const view = await call('post', '/storage/views', { name: 'Books only' }).expect(201);
      matches(StorageViewItem, view.body);
      matches(ViewDeleted, (await call('delete', `/storage/views/${view.body.id}`).expect(200)).body);
    });

    it('versions, restore and bulk download', async () => {
      const version = await call('post', `/storage/files/${statementId}/versions`, {}).expect(201);
      matches(FileVersionItem, version.body);
      expect(version.body).not.toHaveProperty('fileHash');
      const versions = await call('get', `/storage/files/${statementId}/versions`).expect(200);
      matches(FileVersionList, versions.body);
      expect(versions.body).toHaveLength(1);
      matches(FileRestored, (await call('post', `/storage/files/${statementId}/restore`).expect(201)).body);
      const downloads = await call('post', '/storage/files/bulk/download', {
        statementIds: [statementId],
      }).expect(201);
      matches(BulkFileDownloads, downloads.body);
      expect(downloads.body.allowed).toBe(1);
    });

    it('shared links, the password masked on every answer', async () => {
      const created = await call('post', `/storage/files/${statementId}/share`, {
        permission: 'view',
        password: 'first-secret',
      }).expect(201);
      matches(CreatedSharedLink, created.body);
      expect(created.body.password).toBe('******');
      const links = await call('get', `/storage/files/${statementId}/shares`).expect(200);
      matches(SharedLinkList, links.body);
      expect(links.body).toHaveLength(1);
      const updated = await call('put', `/storage/shares/${created.body.id}`, {
        password: 'second-secret',
        description: 'For the accountant',
      }).expect(200);
      matches(SharedLinkItem, updated.body);
      expect(updated.body.password).toBe('******');
      matches(
        MessageResult,
        (await call('delete', `/storage/shares/${created.body.id}`).expect(200)).body,
      );
    });

    it('permissions of a member', async () => {
      const granted = await call('post', `/storage/files/${statementId}/permissions`, {
        userId: member.email,
        permissionType: 'viewer',
      }).expect(201);
      matches(FilePermissionRecord, granted.body);
      const list = await call('get', `/storage/files/${statementId}/permissions`).expect(200);
      matches(FilePermissionList, list.body);
      expect(list.body[0].user.email).toBe(member.email);
      expect(list.body[0].user).not.toHaveProperty('lastLogin');
      const updated = await call('put', `/storage/permissions/${granted.body.id}`, {
        canReshare: true,
      }).expect(200);
      matches(FilePermissionRecord, updated.body);
      expect(updated.body.canReshare).toBe(true);
      matches(
        MessageResult,
        (await call('delete', `/storage/permissions/${granted.body.id}`).expect(200)).body,
      );
    });

    it('the trash, one file and in bulk', async () => {
      const { statementId: one } = await bookExpense('Example Kiosk - Paper', '3.20');
      const { statementId: two } = await bookExpense('Example Kiosk - Pens', '4.10');
      const trashed = await call('post', `/storage/files/${one}/trash`).expect(201);
      matches(FileTrashed, trashed.body);
      expect(trashed.body.status).toBe('trashed');
      const back = await call('post', `/storage/files/${one}/trash/restore`).expect(201);
      matches(FileUntrashed, back.body);
      expect(back.body.status).toBe('restored');

      const bulkTrashed = await call('post', '/storage/files/bulk/delete', {
        statementIds: [one, two],
      }).expect(201);
      matches(BulkFilesDeleted, bulkTrashed.body);
      const restored = await call('post', '/storage/files/trash/bulk/restore', {
        statementIds: [one, two],
      }).expect(201);
      matches(BulkFilesRestored, restored.body);
      expect(restored.body.restored).toBe(2);

      await call('post', `/storage/files/${one}/trash`).expect(201);
      await call('post', `/storage/files/${two}/trash`).expect(201);
      matches(FileDeleted, (await call('delete', `/storage/files/${one}/trash`).expect(200)).body);
      const purged = await call('post', '/storage/files/bulk/trash/delete', {
        statementIds: [two],
      }).expect(201);
      matches(BulkFilesDeleted, purged.body);
      expect(purged.body.deleted).toBe(1);
    });
  });
});
