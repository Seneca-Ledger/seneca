jest.mock('franc', () => ({
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

  describe('Gmail receipts list', () => {
    const list = '/integrations/gmail/receipts?includeLinkedScans=true';

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

  describe('Gmail receipt by id', () => {
    it('finds it in its own workspace', async () => {
      const res = await as(
        owner,
        request(server()).get(`/integrations/gmail/receipts/${receiptId}`),
        secondWorkspaceId,
      ).expect(200);
      expect(res.body.receipt.id).toBe(receiptId);
    });

    it('does not find it from the other workspace', () => {
      return as(owner, request(server()).get(`/integrations/gmail/receipts/${receiptId}`)).expect(
        400,
      );
    });

    it('does not serve its file or thumbnail from the other workspace', async () => {
      for (const suffix of ['file', 'thumbnail']) {
        const res = await as(
          owner,
          request(server()).get(`/integrations/gmail/receipts/${receiptId}/${suffix}`),
        ).expect(404);
        expect(res.body).toEqual({ error: 'Receipt not found' });
      }
    });

    it('cannot be edited from the other workspace', async () => {
      await as(owner, request(server()).patch(`/integrations/gmail/receipts/${receiptId}`))
        .send({ parsedData: { vendor: 'Hijacked' } })
        .expect(400);

      const [row] = await dataSource.query('SELECT parsed_data FROM receipts WHERE id = $1', [
        receiptId,
      ]);
      expect(row.parsed_data.vendor).toBe('Iso Cafe');
    });

    it('cannot be approved from the other workspace', () => {
      return as(owner, request(server()).post(`/integrations/gmail/receipts/${receiptId}/approve`))
        .send({ amount: 12.5, date: '2026-09-01', description: 'Iso Cafe' })
        .expect(400);
    });

    it('books the approved transaction into the receipt’s workspace', async () => {
      const res = await as(
        owner,
        request(server()).post(`/integrations/gmail/receipts/${receiptId}/approve`),
        secondWorkspaceId,
      )
        .send({ amount: 12.5, date: '2026-09-01', currency: 'EUR', description: 'Iso Cafe' })
        .expect(201);

      const [row] = await dataSource.query('SELECT workspace_id FROM transactions WHERE id = $1', [
        res.body.transaction.id,
      ]);
      expect(row.workspace_id).toBe(secondWorkspaceId);
    });
  });

  describe('Gmail integration', () => {
    const oauthEnv = {
      GMAIL_CLIENT_ID: 'iso-client',
      GMAIL_CLIENT_SECRET: 'iso-secret',
      GMAIL_REDIRECT_URI: 'https://app.example.com/api/v1/integrations/gmail/callback',
    };
    const savedEnv: Record<string, string | undefined> = {};

    beforeAll(async () => {
      for (const [key, value] of Object.entries(oauthEnv)) {
        savedEnv[key] = process.env[key];
        process.env[key] = value;
      }
      await dataSource.query(
        `INSERT INTO integrations (workspace_id, provider, status, connected_by_user_id)
         VALUES ($1, 'gmail', 'connected', $2)`,
        [owner.workspaceId, owner.userId],
      );
    });

    afterAll(async () => {
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
      await dataSource.query(
        "DELETE FROM integrations WHERE provider = 'gmail' AND connected_by_user_id = $1",
        [owner.userId],
      );
    });

    it('is connected only in the workspace it was connected in', async () => {
      const first = await as(owner, request(server()).get('/integrations/gmail/status')).expect(
        200,
      );
      expect(first.body.connected).toBe(true);

      const second = await as(
        owner,
        request(server()).get('/integrations/gmail/status'),
        secondWorkspaceId,
      ).expect(200);
      expect(second.body.connected).toBe(false);
    });

    it('connects the workspace that is open', async () => {
      const res = await as(
        owner,
        request(server()).get('/integrations/gmail/connect'),
        secondWorkspaceId,
      ).expect(200);

      const state = new URL(res.body.url).searchParams.get('state') ?? '';
      const payload = JSON.parse(Buffer.from(state.split('.')[0], 'base64url').toString('utf8'));
      expect(payload).toMatchObject({ userId: owner.userId, workspaceId: secondWorkspaceId });
    });

    it('leaves connecting to those who manage the workspace', () => {
      return as(
        member,
        request(server()).get('/integrations/gmail/connect'),
        secondWorkspaceId,
      ).expect(403);
    });
  });

  describe('Cloud storage integrations', () => {
    beforeAll(async () => {
      await dataSource.query(
        `INSERT INTO integrations (workspace_id, provider, status, connected_by_user_id)
         VALUES ($1, 'dropbox', 'connected', $2)`,
        [owner.workspaceId, owner.userId],
      );
    });

    afterAll(async () => {
      await dataSource.query(
        "DELETE FROM integrations WHERE provider = 'dropbox' AND connected_by_user_id = $1",
        [owner.userId],
      );
    });

    it('shows the integration only in the workspace it was connected in', async () => {
      // No token was stored, so the connected one reads as needing re-authorisation.
      const first = await as(owner, request(server()).get('/integrations/dropbox/status')).expect(
        200,
      );
      expect(first.body.status).toBe('needs_reauth');

      const second = await as(
        owner,
        request(server()).get('/integrations/dropbox/status'),
        secondWorkspaceId,
      ).expect(200);
      expect(second.body).toMatchObject({ connected: false, status: 'disconnected' });
    });

    it('leaves managing it to those who manage the workspace', () => {
      return as(
        member,
        request(server()).post('/integrations/dropbox/sync'),
        secondWorkspaceId,
      ).expect(403);
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
