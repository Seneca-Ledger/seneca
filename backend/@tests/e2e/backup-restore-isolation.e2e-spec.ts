jest.mock('franc', () => ({
  franc: () => 'und',
}));

import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { BackupArchiveService } from '../../src/modules/backups/backup-archive.service';
import { BackupDataService } from '../../src/modules/backups/backup-data.service';
import {
  deleteUserByEmail,
  type E2eAccount,
  e2eTestingModule,
  registerAccount,
} from './helpers/e2e-app';
import { seedWorkspace } from './helpers/seed-workspace';

type Row = Record<string, unknown>;
type Snapshot = Awaited<ReturnType<BackupDataService['collect']>>;

/**
 * A backup archive is built by whoever uploads it: anyone can make one with
 * the same code the app uses and a password of their choosing. Restoring it
 * may only ever fill the new workspace — never a table every workspace
 * shares, never a row of another workspace, never a link into one.
 */
describe('Backup restore isolation (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const stamp = Date.now();
  const emails = [`restore-a-${stamp}@example.com`, `restore-b-${stamp}@example.com`];
  const password = 'restore isolation password';
  const archives = new BackupArchiveService();
  const restoredWorkspaceIds: string[] = [];
  let a: E2eAccount;
  let b: E2eAccount;

  const as = (req: request.Test) => req.set('Authorization', `Bearer ${a.token}`);
  const server = () => app.getHttpServer();
  const snapshot = (workspaceId: string): Promise<Snapshot> =>
    app.get(BackupDataService).collect(workspaceId);

  /** Uploads an archive holding `collections` and restores it as A. */
  const restore = async (
    collections: Record<string, unknown[]>,
    files: Snapshot['files'] = [],
  ): Promise<request.Response> => {
    const sourceId = randomUUID();
    const archive = await archives.create({
      password,
      workspace: { id: sourceId, name: 'Crafted' },
      collections: { workspace: [{ id: sourceId, name: 'Crafted', currency: 'USD' }], ...collections },
      files,
    });
    const preview = await as(request(server()).post('/backups/import/preview'))
      .attach('file', archive, 'crafted.seneca-backup')
      .field('password', password)
      .expect(201);
    const res = await as(request(server()).post(`/backups/imports/${preview.body.importId}/restore`))
      .attach('file', archive, 'crafted.seneca-backup')
      .field('password', password);
    if (res.body?.workspaceId) restoredWorkspaceIds.push(res.body.workspaceId);
    return res;
  };

  /** Every row id a snapshot holds. */
  const idsOf = (data: Snapshot): string[] =>
    Object.values(data.collections)
      .flat()
      .map(row => (row as Row).id)
      .filter((id): id is string => typeof id === 'string');

  /** The `table.column` of every value in `data` that holds one of `ids`. */
  const referencesTo = (ids: string[], data: Snapshot, skip: string[] = []): string[] =>
    Object.entries(data.collections).flatMap(([table, rows]) =>
      (rows as Row[]).flatMap(row =>
        Object.entries(row)
          .filter(([column]) => !skip.includes(`${table}.${column}`))
          .filter(([, value]) => ids.some(id => JSON.stringify(value ?? null).includes(id)))
          .map(([column]) => `${table}.${column}`),
      ),
    );

  /** A row of `data`'s `table`, as a new row of an archive: its own id, its references kept. */
  const copyOf = (data: Snapshot, table: string): Row => {
    const row = data.collections[table]?.[0] as Row | undefined;
    if (!row) throw new Error(`The seeded workspace has no ${table}`);
    return { ...row, id: randomUUID() };
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await e2eTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    dataSource = moduleFixture.get(DataSource);

    a = await registerAccount(app, emails[0], 'Restore A');
    b = await registerAccount(app, emails[1], 'Restore B');
    await seedWorkspace(app, dataSource, a, `arestore${stamp}`);
    await seedWorkspace(app, dataSource, b, `brestore${stamp}`);
  }, 180_000);

  afterAll(async () => {
    if (dataSource) {
      for (const id of restoredWorkspaceIds) {
        await dataSource.query('DELETE FROM workspaces WHERE id = $1', [id]).catch(() => undefined);
      }
      for (const email of emails) await deleteUserByEmail(dataSource, email);
    }
    await app.close();
  });

  it('does not restore a share link or file permission onto another workspace’s statement', async () => {
    const [statement] = await dataSource.query(
      'SELECT id FROM statements WHERE workspace_id = $1 LIMIT 1',
      [b.workspaceId],
    );
    const token = `crafted${stamp}`;

    const res = await restore({
      shared_links: [
        {
          id: randomUUID(),
          statementId: statement.id,
          userId: a.userId,
          token,
          permission: 'edit',
          status: 'active',
          allowAnonymous: true,
          accessCount: 0,
        },
      ],
      file_permissions: [
        {
          id: randomUUID(),
          statementId: statement.id,
          userId: a.userId,
          grantedById: a.userId,
          permissionType: 'editor',
          canReshare: true,
          isActive: true,
        },
      ],
    });

    expect(res.status).toBe(400);
    await request(server()).get(`/storage/shared/${token}`).expect(404);
    const [links] = await dataSource.query(
      'SELECT count(*)::int AS count FROM shared_links WHERE token = $1',
      [token],
    );
    const [permissions] = await dataSource.query(
      'SELECT count(*)::int AS count FROM file_permissions WHERE statement_id = $1 AND user_id = $2',
      [statement.id, a.userId],
    );
    expect(links.count).toBe(0);
    expect(permissions.count).toBe(0);
  });

  it('does not write a table every workspace shares', async () => {
    const source = `crafted${stamp}`.slice(0, 50);

    const res = await restore({
      exchange_rates: [
        {
          id: randomUUID(),
          baseCurrency: 'USD',
          targetCurrency: 'EUR',
          rate: 0.01234567,
          rateDate: '2099-01-01',
          source,
        },
      ],
    });

    expect(res.status).toBe(400);
    const [rates] = await dataSource.query(
      'SELECT count(*)::int AS count FROM exchange_rates WHERE source = $1',
      [source],
    );
    expect(rates.count).toBe(0);
  });

  it('restores nothing that points into another workspace and adds nothing to it', async () => {
    const before = await snapshot(b.workspaceId);

    const res = await restore({
      // A row of the archive's own, whose references all lead into B.
      transactions: [copyOf(before, 'transactions')],
      categories: [{ ...copyOf(before, 'categories'), parentId: (before.collections.categories[0] as Row).id }],
      // Required references into B: such a row cannot come along at all.
      budgets: [copyOf(before, 'budgets')],
      payable_payments: [copyOf(before, 'payable_payments')],
      // Rows of B's parents, which have no workspace of their own.
      invoice_line_items: [copyOf(before, 'invoice_line_items')],
      custom_table_rows: [copyOf(before, 'custom_table_rows')],
      file_versions: [copyOf(before, 'file_versions')],
    });

    expect(res.status).toBe(201);
    const restored = await snapshot(res.body.workspaceId);
    expect(referencesTo(idsOf(before), restored)).toEqual([]);
    expect(restored.collections.transactions).toHaveLength(1);
    expect(restored.collections.categories).toHaveLength(1);
    expect(restored.collections.budgets).toHaveLength(0);
    expect(restored.collections.payable_payments).toHaveLength(0);
    expect(await snapshot(b.workspaceId)).toEqual(before);
  });

  it('still restores a backup of a whole workspace into a new one', async () => {
    const source = await snapshot(a.workspaceId);
    const [workspace] = await dataSource.query(
      'SELECT id, name, currency FROM workspaces WHERE id = $1',
      [a.workspaceId],
    );
    const archive = await archives.create({
      password,
      workspace: { id: workspace.id, name: workspace.name },
      collections: { workspace: [workspace], ...source.collections },
      files: source.files,
    });
    const preview = await as(request(server()).post('/backups/import/preview'))
      .attach('file', archive, 'a.seneca-backup')
      .field('password', password)
      .expect(201);
    const res = await as(request(server()).post(`/backups/imports/${preview.body.importId}/restore`))
      .attach('file', archive, 'a.seneca-backup')
      .field('password', password)
      .expect(201);
    restoredWorkspaceIds.push(res.body.workspaceId);

    const restored = await snapshot(res.body.workspaceId);
    const counts = (data: Snapshot) =>
      Object.fromEntries(
        Object.entries(data.collections)
          // The restore logs itself into the new workspace.
          .filter(([table]) => table !== 'audit_events')
          .map(([table, rows]) => [table, rows.length]),
      );
    expect(counts(restored)).toEqual(counts(source));
    expect(restored.files.length).toBe(source.files.length);
    // The log keeps what it recorded: the subject an event names (a member or
    // an import of the source workspace, which never come along) and the
    // request path it was made from.
    expect(
      referencesTo(idsOf(source), restored, ['audit_events.entityId', 'audit_events.meta']),
    ).toEqual([]);
  });
});
