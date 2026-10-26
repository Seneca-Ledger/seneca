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

interface ListedReceipt {
  id: string;
}

/**
 * One user in two workspaces must see each workspace's data only there. The
 * current workspace is the `x-workspace-id` header; the user's own
 * `workspaceId` is merely the workspace they registered with, and switching
 * never changes it, so nothing may be scoped by it or by the user alone.
 */
describe('Workspace isolation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = {
    owner: `iso-owner-${stamp}@example.com`,
    member: `iso-member-${stamp}@example.com`,
    other: `iso-other-${stamp}@example.com`,
  };
  let owner: E2eAccount;
  let member: E2eAccount;
  let other: E2eAccount;
  /** The owner's second workspace; `owner.workspaceId` is the first. */
  let secondWorkspaceId: string;
  /** A scan the owner uploaded into the second workspace. */
  let receiptId: string;

  const as = (account: E2eAccount, req: request.Test, workspaceId = account.workspaceId) =>
    req.set('Authorization', `Bearer ${account.token}`).set('x-workspace-id', workspaceId);
  const server = () => app.getHttpServer();
  const listed = (res: request.Response) =>
    (res.body.receipts as ListedReceipt[]).map(receipt => receipt.id);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    owner = await registerAccount(app, emails.owner, 'Isolation Owner');
    member = await registerAccount(app, emails.member, 'Isolation Member');
    other = await registerAccount(app, emails.other, 'Isolation Other');

    const created = await request(server())
      .post('/workspaces')
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ name: 'Second workspace' })
      .expect(201);
    secondWorkspaceId = created.body.id;

    const invitation = await as(
      owner,
      request(server()).post(`/workspaces/${secondWorkspaceId}/invitations`),
      secondWorkspaceId,
    )
      .send({ email: member.email, role: 'member' })
      .expect(201);
    await as(
      member,
      request(server()).post(`/workspaces/invitations/${invitation.body.invitation.token}/accept`),
    ).expect(200);

    // Inserted directly: the upload path runs OCR, which is beside the point here.
    const [row] = await dataSource.query(
      `INSERT INTO receipts (user_id, workspace_id, source, subject, sender, received_at, status, parsed_data)
       VALUES ($1, $2, 'scan', 'Scan', 'upload', now(), 'draft', $3)
       RETURNING id`,
      [
        owner.userId,
        secondWorkspaceId,
        JSON.stringify({ amount: 12.5, currency: 'EUR', date: '2026-09-01', vendor: 'Iso Cafe' }),
      ],
    );
    receiptId = row.id;
  });

  afterAll(async () => {
    if (dataSource) {
      await dataSource.query(
        'DELETE FROM transactions WHERE id IN (SELECT transaction_id FROM receipts WHERE user_id = $1)',
        [owner?.userId],
      );
      await dataSource.query('DELETE FROM folders WHERE user_id = $1', [owner?.userId]);
      for (const email of Object.values(emails)) {
        await deleteUserByEmail(dataSource, email);
      }
    }
    await app.close();
  });

  describe('Receipt documents list', () => {
    const list = '/receipts/documents?includeLinkedScans=true';

    it('shows the receipt in the workspace it was uploaded to', async () => {
      const res = await as(owner, request(server()).get(list), secondWorkspaceId).expect(200);
      expect(listed(res)).toContain(receiptId);
    });

    it('hides it from the same user’s other workspace', async () => {
      const res = await as(owner, request(server()).get(list)).expect(200);
      expect(listed(res)).not.toContain(receiptId);
    });

    it('shows it to another member of that workspace', async () => {
      const res = await as(member, request(server()).get(list), secondWorkspaceId).expect(200);
      expect(listed(res)).toContain(receiptId);
    });

    it('hides it from another user’s workspace', async () => {
      const res = await as(other, request(server()).get(list)).expect(200);
      expect(listed(res)).not.toContain(receiptId);
    });

    it('refuses a workspace the caller is not a member of', () => {
      return as(other, request(server()).get(list), secondWorkspaceId).expect(403);
    });

    it('requires a workspace', () => {
      return request(server())
        .get(list)
        .set('Authorization', `Bearer ${owner.token}`)
        .expect(403);
    });
  });

  describe('Receipt by id', () => {
    it('finds it in its own workspace', async () => {
      const res = await as(
        owner,
        request(server()).get(`/receipts/${receiptId}`),
        secondWorkspaceId,
      ).expect(200);
      expect(res.body.id).toBe(receiptId);
    });

    it('does not find it from the other workspace', () => {
      return as(owner, request(server()).get(`/receipts/${receiptId}`)).expect(400);
    });

    it('does not serve its file or thumbnail from the other workspace', async () => {
      const file = await as(owner, request(server()).get(`/receipts/${receiptId}/file`)).expect(
        404,
      );
      expect(file.body).toEqual({ error: 'Receipt file not found' });
      const thumbnail = await as(
        owner,
        request(server()).get(`/receipts/${receiptId}/thumbnail`),
      ).expect(404);
      expect(thumbnail.body).toEqual({ error: 'Receipt not found' });
    });

    it('cannot be edited from the other workspace', async () => {
      await as(owner, request(server()).patch(`/receipts/${receiptId}`))
        .send({ parsedData: { vendor: 'Hijacked' } })
        .expect(400);

      const [row] = await dataSource.query('SELECT parsed_data FROM receipts WHERE id = $1', [
        receiptId,
      ]);
      expect(row.parsed_data.vendor).toBe('Iso Cafe');
    });

    it('cannot be approved from the other workspace', () => {
      return as(owner, request(server()).post(`/receipts/${receiptId}/approve`))
        .send({})
        .expect(400);
    });

    it('books the approved transaction into the receipt’s workspace', async () => {
      const res = await as(
        owner,
        request(server()).post(`/receipts/${receiptId}/approve`),
        secondWorkspaceId,
      )
        .send({})
        .expect(201);

      const [row] = await dataSource.query('SELECT workspace_id FROM transactions WHERE id = $1', [
        res.body.transaction.id,
      ]);
      expect(row.workspace_id).toBe(secondWorkspaceId);
    });
  });

  describe('Storage', () => {
    /** Statements the owner booked, keyed by the workspace they went into. */
    const statementIn: Record<'first' | 'second', string> = { first: '', second: '' };
    const fileIds = (res: request.Response) => (res.body as ListedReceipt[]).map(file => file.id);

    async function bookExpense(workspaceId: string): Promise<string> {
      const categories = await as(
        owner,
        request(server()).get('/categories?type=expense'),
        workspaceId,
      ).expect(200);
      const statement = await as(
        owner,
        request(server()).post('/statements/manual-expense'),
        workspaceId,
      )
        .field('amount', '42')
        .field('currency', 'EUR')
        .field('merchant', 'Iso Store')
        .field('categoryId', categories.body[0].id)
        .field('date', '2026-09-02')
        .expect(201);
      return statement.body.id;
    }

    beforeAll(async () => {
      statementIn.first = await bookExpense(owner.workspaceId);
      statementIn.second = await bookExpense(secondWorkspaceId);
    });

    it('lists each workspace’s files only there', async () => {
      const first = await as(owner, request(server()).get('/storage/files')).expect(200);
      expect(fileIds(first)).toContain(statementIn.first);
      expect(fileIds(first)).not.toContain(statementIn.second);

      const second = await as(
        owner,
        request(server()).get('/storage/files'),
        secondWorkspaceId,
      ).expect(200);
      expect(fileIds(second)).toContain(statementIn.second);
      expect(fileIds(second)).not.toContain(statementIn.first);
    });

    it('opens a file for members of its own workspace only', async () => {
      // The member registered with a workspace of their own; access follows
      // membership in the file's workspace, not the one they registered with.
      const res = await as(
        member,
        request(server()).get(`/storage/files/${statementIn.second}`),
        secondWorkspaceId,
      ).expect(200);
      expect(res.body.statement.id).toBe(statementIn.second);

      await as(other, request(server()).get(`/storage/files/${statementIn.second}`)).expect(403);
    });

    it('keeps the trash per workspace too', async () => {
      await as(owner, request(server()).post(`/storage/files/${statementIn.first}/trash`)).expect(
        201,
      );

      const second = await as(
        owner,
        request(server()).get('/storage/files?deleted=only'),
        secondWorkspaceId,
      ).expect(200);
      expect(fileIds(second)).not.toContain(statementIn.first);

      const first = await as(owner, request(server()).get('/storage/files?deleted=only')).expect(
        200,
      );
      expect(fileIds(first)).toContain(statementIn.first);
    });

    it('creates a folder in the current workspace and lists it only there', async () => {
      const created = await as(owner, request(server()).post('/storage/folders'), secondWorkspaceId)
        .send({ name: 'Iso folder' })
        .expect(201);

      const second = await as(
        owner,
        request(server()).get('/storage/folders'),
        secondWorkspaceId,
      ).expect(200);
      expect(fileIds(second)).toContain(created.body.id);

      const first = await as(owner, request(server()).get('/storage/folders')).expect(200);
      expect(fileIds(first)).not.toContain(created.body.id);
    });

    it('does not list another tenant’s workspace-wide folders', async () => {
      const [folder] = await dataSource.query(
        `INSERT INTO folders (name, user_id, workspace_id) VALUES ('Foreign', NULL, $1) RETURNING id`,
        [other.workspaceId],
      );
      try {
        const res = await as(owner, request(server()).get('/storage/folders')).expect(200);
        expect(fileIds(res)).not.toContain(folder.id);

        const own = await as(other, request(server()).get('/storage/folders')).expect(200);
        expect(fileIds(own)).toContain(folder.id);
      } finally {
        await dataSource.query('DELETE FROM folders WHERE id = $1', [folder.id]);
      }
    });
  });
});
