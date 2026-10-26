import {
  BackupRestoreService,
  withoutRemovedSources,
} from '../../../../src/modules/backups/backup-restore.service';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('BackupRestoreService', () => {
  it('restores a backup into a new workspace and remaps workspace and user references', async () => {
    const categoryInsert = vi.fn().mockResolvedValue(undefined);
    const workspaceRepository = {
      create: vi.fn().mockImplementation(value => ({ id: 'new-workspace', ...value })),
      save: vi.fn().mockResolvedValue({ id: 'new-workspace', name: 'Restored finance' }),
      delete: vi.fn(),
    };
    const memberRepository = { create: vi.fn().mockImplementation(value => value), save: vi.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: vi.fn().mockReturnValue({ insert: categoryInsert }), query: vi.fn().mockResolvedValue([]) };
    const dataSource = {
      entityMetadatas: [
        {
          tableName: 'categories',
          target: 'Category',
          columns: [{ propertyName: 'id' }, { propertyName: 'workspaceId' }, { propertyName: 'userId' }, { propertyName: 'name' }],
        },
      ],
      transaction: vi.fn().mockImplementation(callback => callback(manager)),
      query: vi.fn().mockResolvedValue([]),
    };
    const archive = {
      open: vi.fn().mockResolvedValue({
        manifest: { workspace: { id: 'old-workspace', name: 'Finance' }, collections: { workspace: 1, categories: 1 }, files: [] },
        collections: {
          workspace: [{ id: 'old-workspace', name: 'Finance', currency: 'KZT' }],
          categories: [{ id: 'old-category', workspaceId: 'old-workspace', userId: 'old-user', name: 'Travel' }],
        },
        files: new Map(),
      }),
    };
    const service = new BackupRestoreService(
      dataSource as never,
      workspaceRepository as never,
      memberRepository as never,
      archive as never,
    );

    const workspace = await service.restore(Buffer.from('archive'), 'backup password', {
      id: 'user-1',
      workspaceId: 'workspace-1',
    } as never, 'Restored finance');

    expect(workspace).toEqual({ id: 'new-workspace', name: 'Restored finance' });
    expect(memberRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: 'new-workspace', userId: 'user-1', role: 'owner' }),
    );
    expect(categoryInsert).toHaveBeenCalledWith(
      [expect.objectContaining({ workspaceId: 'new-workspace', userId: 'user-1', name: 'Travel' })],
    );
  });

  it('restores statement documents from the portable file collection', async () => {
    const uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'seneca-restore-'));
    const previousUploads = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploads;
    const statementInsert = vi.fn().mockResolvedValue(undefined);
    const workspaceRepository = {
      create: vi.fn().mockImplementation(value => ({ id: 'new-workspace', ...value })),
      save: vi.fn().mockResolvedValue({ id: 'new-workspace', name: 'Restored finance' }),
      delete: vi.fn(),
    };
    const memberRepository = { create: vi.fn().mockImplementation(value => value), save: vi.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: vi.fn().mockReturnValue({ insert: statementInsert }), query: vi.fn().mockResolvedValue([]) };
    const archive = {
      open: vi.fn().mockResolvedValue({
        manifest: { workspace: { id: 'old-workspace', name: 'Finance' }, collections: { workspace: 1, statements: 1 }, files: [] },
        collections: {
          workspace: [{ id: 'old-workspace', name: 'Finance' }],
          statements: [{ id: 'old-statement', workspaceId: 'old-workspace', userId: 'old-user', fileName: 'bank.csv', filePath: 'statements/old-statement/bank.csv' }],
        },
        files: new Map([['statements/old-statement/bank.csv', Buffer.from('date,amount\n')]]),
      }),
    };
    const service = new BackupRestoreService(
      {
        entityMetadatas: [
          {
            tableName: 'statements',
            target: 'Statement',
            columns: [{ propertyName: 'id' }, { propertyName: 'workspaceId' }, { propertyName: 'userId' }, { propertyName: 'fileName' }, { propertyName: 'filePath' }],
          },
        ],
        transaction: vi.fn().mockImplementation(callback => callback(manager)),
        query: vi.fn().mockResolvedValue([]),
      } as never,
      workspaceRepository as never,
      memberRepository as never,
      archive as never,
    );

    await service.restore(Buffer.from('archive'), 'backup password', { id: 'user-1', workspaceId: 'workspace-1' } as never);

    const inserted = statementInsert.mock.calls[0][0][0];
    await expect(fs.readFile(inserted.filePath, 'utf8')).resolves.toBe('date,amount\n');
    if (previousUploads === undefined) {
      delete process.env.UPLOADS_DIR;
    } else {
      process.env.UPLOADS_DIR = previousUploads;
    }
    await fs.rm(uploads, { recursive: true, force: true });
  });

  it('skips custom_table_import_jobs from backups made before the Google Sheets removal', async () => {
    const categoryInsert = vi.fn().mockResolvedValue(undefined);
    const workspaceRepository = {
      create: vi.fn().mockImplementation(value => ({ id: 'new-workspace', ...value })),
      save: vi.fn().mockResolvedValue({ id: 'new-workspace', name: 'Finance' }),
      delete: vi.fn(),
    };
    const memberRepository = { create: vi.fn().mockImplementation(value => value), save: vi.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: vi.fn().mockReturnValue({ insert: categoryInsert }), query: vi.fn().mockResolvedValue([]) };
    const archive = {
      open: vi.fn().mockResolvedValue({
        manifest: { workspace: { id: 'old-workspace', name: 'Finance' }, collections: {}, files: [] },
        collections: {
          workspace: [{ id: 'old-workspace', name: 'Finance' }],
          categories: [{ id: 'old-category', workspaceId: 'old-workspace', name: 'Travel' }],
          custom_table_import_jobs: [{ id: 'old-job', workspaceId: 'old-workspace', type: 'google_sheets' }],
        },
        files: new Map(),
      }),
    };
    const service = new BackupRestoreService(
      {
        entityMetadatas: [
          { tableName: 'categories', target: 'Category', columns: [{ propertyName: 'id' }, { propertyName: 'workspaceId' }, { propertyName: 'name' }] },
        ],
        transaction: vi.fn().mockImplementation(callback => callback(manager)),
        query: vi.fn().mockResolvedValue([]),
      } as never,
      workspaceRepository as never,
      memberRepository as never,
      archive as never,
    );

    await expect(
      service.restore(Buffer.from('archive'), 'backup password', { id: 'user-1', workspaceId: 'workspace-1' } as never),
    ).resolves.toEqual({ id: 'new-workspace', name: 'Finance' });
    expect(manager.getRepository).toHaveBeenCalledTimes(1);
    expect(categoryInsert).toHaveBeenCalledWith([expect.objectContaining({ name: 'Travel' })]);
  });

  it('inserts a table after the tables its foreign keys point at, even keys only migrations declare', async () => {
    const inserted: string[] = [];
    const workspaceRepository = {
      create: vi.fn().mockImplementation(value => ({ id: 'new-workspace', ...value })),
      save: vi.fn().mockResolvedValue({ id: 'new-workspace', name: 'Finance' }),
      delete: vi.fn(),
    };
    const memberRepository = { create: vi.fn().mockImplementation(value => value), save: vi.fn().mockResolvedValue(undefined) };
    const manager = {
      getRepository: vi.fn().mockImplementation((target: string) => ({
        insert: vi.fn().mockImplementation(async () => {
          inserted.push(target);
        }),
      })),
      // categories.ledger_account_id -> ledger_accounts, and categories.parent_id -> categories.
      query: vi.fn().mockResolvedValue([
        { source: 'categories', target: 'ledger_accounts' },
        { source: 'categories', target: 'categories' },
      ]),
    };
    const archive = {
      open: vi.fn().mockResolvedValue({
        manifest: { workspace: { id: 'old-workspace', name: 'Finance' }, collections: {}, files: [] },
        collections: {
          workspace: [{ id: 'old-workspace', name: 'Finance' }],
          categories: [{ id: 'old-category', workspaceId: 'old-workspace', ledgerAccountId: 'old-account', name: 'Travel' }],
          ledger_accounts: [{ id: 'old-account', workspaceId: 'old-workspace', name: 'Travel expenses' }],
        },
        files: new Map(),
      }),
    };
    const columns = (...names: string[]) => names.map(propertyName => ({ propertyName }));
    const service = new BackupRestoreService(
      {
        entityMetadatas: [
          { tableName: 'categories', target: 'Category', columns: columns('id', 'workspaceId', 'ledgerAccountId', 'name') },
          { tableName: 'ledger_accounts', target: 'LedgerAccount', columns: columns('id', 'workspaceId', 'name') },
        ],
        transaction: vi.fn().mockImplementation(callback => callback(manager)),
        query: vi.fn().mockResolvedValue([]),
      } as never,
      workspaceRepository as never,
      memberRepository as never,
      archive as never,
    );

    await service.restore(Buffer.from('archive'), 'backup password', { id: 'user-1', workspaceId: 'workspace-1' } as never);

    expect(inserted).toEqual(['LedgerAccount', 'Category']);
  });

  describe('what an archive may restore', () => {
    type Column = { propertyName: string; databaseName?: string; type?: string; isNullable?: boolean };
    const column = (propertyName: string, options: Partial<Column> = {}): Column => ({
      propertyName,
      databaseName: propertyName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
      isNullable: true,
      ...options,
    });
    const table = (tableName: string, ...columns: Column[]) => ({ tableName, target: tableName, columns });
    const workspaceTable = (tableName: string, ...columns: Column[]) =>
      table(tableName, column('id', { type: 'uuid', isNullable: false }), column('workspaceId', { type: 'uuid' }), ...columns);

    /** Restores `collections` against these tables and foreign keys; answers what each table got. */
    const restoreWith = async (
      metadatas: ReturnType<typeof table>[],
      foreignKeys: Array<{ source: string; column: string; target: string }>,
      collections: Record<string, unknown[]>,
    ) => {
      const inserted: Record<string, Record<string, unknown>[]> = {};
      const workspaceRepository = {
        create: vi.fn().mockImplementation(value => ({ id: 'new-workspace', ...value })),
        save: vi.fn().mockResolvedValue({ id: 'new-workspace', name: 'Finance' }),
        delete: vi.fn(),
      };
      const manager = {
        getRepository: vi.fn().mockImplementation((target: string) => ({
          insert: vi.fn().mockImplementation(async (values: Record<string, unknown>[]) => {
            inserted[target] = values;
          }),
        })),
        query: vi.fn().mockResolvedValue([]),
      };
      const service = new BackupRestoreService(
        {
          entityMetadatas: metadatas,
          transaction: vi.fn().mockImplementation(callback => callback(manager)),
          query: vi.fn().mockResolvedValue(foreignKeys),
        } as never,
        workspaceRepository as never,
        { create: vi.fn().mockImplementation(value => value), save: vi.fn() } as never,
        {
          open: vi.fn().mockResolvedValue({
            manifest: { collections: {}, files: [] },
            collections: { workspace: [{ id: 'old-workspace', name: 'Finance' }], ...collections },
            files: new Map(),
          }),
        } as never,
      );
      const result = service.restore(Buffer.from('archive'), 'backup password', { id: 'user-1' } as never);
      return { result, inserted, workspaceRepository };
    };

    const categoryRow = { id: 'old-category', workspaceId: 'old-workspace', name: 'Travel' };
    const categories = workspaceTable('categories', column('name'));

    it('refuses a table every workspace shares, before making a workspace', async () => {
      const { result, workspaceRepository } = await restoreWith(
        [categories, table('exchange_rates', column('id'), column('rate'))],
        [],
        { categories: [categoryRow], exchange_rates: [{ id: 'rate-1', rate: 0.01 }] },
      );

      await expect(result).rejects.toThrow('Backup contains unsupported collection: exchange_rates');
      expect(workspaceRepository.save).not.toHaveBeenCalled();
    });

    it('refuses a table without a workspace that is no related collection', async () => {
      const { result } = await restoreWith(
        [categories, table('shared_links', column('id'), column('statementId', { type: 'uuid' }), column('token'))],
        [],
        { shared_links: [{ id: 'link-1', statementId: 'their-statement', token: 'known' }] },
      );

      await expect(result).rejects.toThrow('Backup contains unsupported collection: shared_links');
    });

    it('skips a workspace table that backups leave out', async () => {
      const { result, inserted } = await restoreWith(
        [categories, workspaceTable('webhook_endpoints', column('url'))],
        [],
        { categories: [categoryRow], webhook_endpoints: [{ id: 'hook-1', workspaceId: 'old-workspace', url: 'http://10.0.0.1' }] },
      );

      await result;
      expect(Object.keys(inserted)).toEqual(['categories']);
    });

    it('keeps references to restored rows and to reference data, and cuts every other one', async () => {
      const { result, inserted } = await restoreWith(
        [
          categories,
          workspaceTable(
            'transactions',
            column('categoryId', { type: 'uuid' }),
            column('ownerMemberId', { type: 'uuid' }),
            column('statementId', { type: 'uuid' }),
            column('splitGroupId', { type: 'uuid' }),
            column('userId', { type: 'uuid' }),
            column('token'),
            column('shareToken'),
            column('externalId'),
            column('meta'),
          ),
          workspaceTable('tax_rates', column('jurisdictionId', { type: 'uuid', isNullable: false })),
        ],
        [
          { source: 'transactions', column: 'category_id', target: 'categories' },
          { source: 'transactions', column: 'owner_member_id', target: 'workspace_members' },
          { source: 'transactions', column: 'user_id', target: 'users' },
          { source: 'tax_rates', column: 'jurisdiction_id', target: 'tax_jurisdictions' },
        ],
        {
          categories: [categoryRow],
          transactions: [
            {
              id: 'old-transaction',
              workspaceId: 'old-workspace',
              categoryId: 'old-category',
              ownerMemberId: 'their-member',
              statementId: '11111111-1111-4111-8111-111111111111',
              splitGroupId: '22222222-2222-4222-8222-222222222222',
              userId: 'old-user',
              token: 'secret',
              shareToken: 'public',
              externalId: 'bank-123',
              meta: {
                categoryId: '33333333-3333-4333-8333-333333333333',
                categoryIds: ['old-category', '44444444-4444-4444-8444-444444444444'],
                jurisdictionId: '55555555-5555-4555-8555-555555555555',
                note: '66666666-6666-4666-8666-666666666666',
                own: { id: 'old-category' },
              },
            },
          ],
          tax_rates: [{ id: 'old-rate', workspaceId: 'old-workspace', jurisdictionId: 'jurisdiction-de' }],
        },
      );

      await result;
      const newCategoryId = inserted.categories[0].id;
      const [transaction] = inserted.transactions;
      expect(transaction).toEqual({
        id: expect.any(String),
        workspaceId: 'new-workspace',
        categoryId: newCategoryId,
        ownerMemberId: null,
        statementId: null,
        splitGroupId: '22222222-2222-4222-8222-222222222222',
        userId: 'user-1',
        shareToken: null,
        externalId: 'bank-123',
        meta: {
          categoryId: null,
          categoryIds: [newCategoryId],
          jurisdictionId: '55555555-5555-4555-8555-555555555555',
          note: '66666666-6666-4666-8666-666666666666',
          own: { id: newCategoryId },
        },
      });
      expect(inserted.tax_rates[0]).toMatchObject({ jurisdictionId: 'jurisdiction-de' });
    });

    it('drops a row whose required reference leads outside the archive, and the rows that need it', async () => {
      const { result, inserted } = await restoreWith(
        [
          categories,
          workspaceTable('budgets', column('categoryId', { type: 'uuid', isNullable: false })),
          workspaceTable('invoices', column('number')),
          table(
            'invoice_line_items',
            column('id', { type: 'uuid', isNullable: false }),
            column('invoiceId', { type: 'uuid', isNullable: false }),
            column('budgetId', { type: 'uuid', isNullable: false }),
          ),
        ],
        [{ source: 'budgets', column: 'category_id', target: 'categories' }],
        {
          categories: [categoryRow],
          budgets: [
            { id: 'own-budget', workspaceId: 'old-workspace', categoryId: 'old-category' },
            { id: 'their-budget', workspaceId: 'old-workspace', categoryId: 'their-category' },
          ],
          invoices: [{ id: 'old-invoice', workspaceId: 'old-workspace', number: 'INV-1' }],
          invoice_line_items: [
            { id: 'own-line', invoiceId: 'old-invoice', budgetId: 'own-budget' },
            // Under another workspace's invoice: a related collection follows its parent only.
            { id: 'their-line', invoiceId: 'their-invoice', budgetId: 'own-budget' },
            // Needs the budget that was dropped.
            { id: 'orphan-line', invoiceId: 'old-invoice', budgetId: 'their-budget' },
          ],
        },
      );

      await result;
      expect(inserted.budgets).toEqual([expect.objectContaining({ categoryId: inserted.categories[0].id })]);
      expect(inserted.invoice_line_items).toEqual([
        { id: expect.any(String), invoiceId: inserted.invoices[0].id, budgetId: inserted.budgets[0].id },
      ]);
    });

    it('does not let a restored audit event be undone against a row that did not come along', async () => {
      const { result, inserted } = await restoreWith(
        [categories, workspaceTable('audit_events', column('entityId', { type: 'uuid', isNullable: false }), column('isUndoable'))],
        [],
        {
          categories: [categoryRow],
          audit_events: [
            { id: 'own-event', workspaceId: 'old-workspace', entityId: 'old-category', isUndoable: true },
            { id: 'their-event', workspaceId: 'old-workspace', entityId: 'their-category', isUndoable: true },
          ],
        },
      );

      await result;
      expect(inserted.audit_events).toEqual([
        expect.objectContaining({ entityId: inserted.categories[0].id, isUndoable: true }),
        expect.objectContaining({ entityId: 'their-category', isUndoable: false }),
      ]);
    });
  });
});

describe('withoutRemovedSources', () => {
  it('leaves Gmail receipts out the way the migration deleted them', () => {
    const result = withoutRemovedSources({
      receipts: [
        { id: 'r-mail', source: 'gmail', gmailMessageId: 'm-1', gmailThreadId: 't-1' },
        { id: 'r-imap', source: 'imap', gmailMessageId: 'imap:1', gmailThreadId: null, duplicateOfId: 'r-mail' },
        { id: 'r-scan', source: 'scan', messageId: null },
      ],
      notes: [
        { id: 'n-1', receiptId: 'r-mail' },
        { id: 'n-2', receiptId: 'r-imap' },
      ],
      investment_holdings: [{ id: 'h-1', receiptId: 'r-mail' }],
      custom_tables: [
        { id: 'ct-1', source: 'google_sheets_import' },
        { id: 'ct-2', source: 'manual' },
      ],
    });

    expect(result.receipts).toEqual([
      { id: 'r-imap', source: 'imap', messageId: 'imap:1', duplicateOfId: null },
      { id: 'r-scan', source: 'scan', messageId: null },
    ]);
    expect(result.notes).toEqual([{ id: 'n-2', receiptId: 'r-imap' }]);
    expect(result.investment_holdings).toEqual([{ id: 'h-1', receiptId: null }]);
    expect(result.custom_tables).toEqual([
      { id: 'ct-1', source: 'manual' },
      { id: 'ct-2', source: 'manual' },
    ]);
  });

  it('passes a backup without Gmail rows through unchanged', () => {
    const collections = {
      receipts: [{ id: 'r-1', source: 'scan', messageId: null }],
      notes: [{ id: 'n-1', receiptId: 'r-1' }],
    };

    expect(withoutRemovedSources(collections)).toEqual(collections);
  });
});
