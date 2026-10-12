import { BackupRestoreService } from '../../../../src/modules/backups/backup-restore.service';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('BackupRestoreService', () => {
  it('restores a backup into a new workspace and remaps workspace and user references', async () => {
    const categoryInsert = jest.fn().mockResolvedValue(undefined);
    const workspaceRepository = {
      create: jest.fn().mockImplementation(value => ({ id: 'new-workspace', ...value })),
      save: jest.fn().mockResolvedValue({ id: 'new-workspace', name: 'Restored finance' }),
      delete: jest.fn(),
    };
    const memberRepository = { create: jest.fn().mockImplementation(value => value), save: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn().mockReturnValue({ insert: categoryInsert }), query: jest.fn().mockResolvedValue([]) };
    const dataSource = {
      entityMetadatas: [
        {
          tableName: 'categories',
          target: 'Category',
          columns: [{ propertyName: 'id' }, { propertyName: 'workspaceId' }, { propertyName: 'userId' }, { propertyName: 'name' }],
        },
      ],
      transaction: jest.fn().mockImplementation(callback => callback(manager)),
    };
    const archive = {
      open: jest.fn().mockResolvedValue({
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
    const uploads = await fs.mkdtemp(path.join(os.tmpdir(), 'lumio-restore-'));
    const previousUploads = process.env.UPLOADS_DIR;
    process.env.UPLOADS_DIR = uploads;
    const statementInsert = jest.fn().mockResolvedValue(undefined);
    const workspaceRepository = {
      create: jest.fn().mockImplementation(value => ({ id: 'new-workspace', ...value })),
      save: jest.fn().mockResolvedValue({ id: 'new-workspace', name: 'Restored finance' }),
      delete: jest.fn(),
    };
    const memberRepository = { create: jest.fn().mockImplementation(value => value), save: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn().mockReturnValue({ insert: statementInsert }), query: jest.fn().mockResolvedValue([]) };
    const archive = {
      open: jest.fn().mockResolvedValue({
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
        transaction: jest.fn().mockImplementation(callback => callback(manager)),
      } as never,
      workspaceRepository as never,
      memberRepository as never,
      archive as never,
    );

    await service.restore(Buffer.from('archive'), 'backup password', { id: 'user-1', workspaceId: 'workspace-1' } as never);

    const inserted = statementInsert.mock.calls[0][0][0];
    await expect(fs.readFile(inserted.filePath, 'utf8')).resolves.toBe('date,amount\n');
    process.env.UPLOADS_DIR = previousUploads;
    await fs.rm(uploads, { recursive: true, force: true });
  });

  it('skips custom_table_import_jobs from backups made before the Google Sheets removal', async () => {
    const categoryInsert = jest.fn().mockResolvedValue(undefined);
    const workspaceRepository = {
      create: jest.fn().mockImplementation(value => ({ id: 'new-workspace', ...value })),
      save: jest.fn().mockResolvedValue({ id: 'new-workspace', name: 'Finance' }),
      delete: jest.fn(),
    };
    const memberRepository = { create: jest.fn().mockImplementation(value => value), save: jest.fn().mockResolvedValue(undefined) };
    const manager = { getRepository: jest.fn().mockReturnValue({ insert: categoryInsert }), query: jest.fn().mockResolvedValue([]) };
    const archive = {
      open: jest.fn().mockResolvedValue({
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
        transaction: jest.fn().mockImplementation(callback => callback(manager)),
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
      create: jest.fn().mockImplementation(value => ({ id: 'new-workspace', ...value })),
      save: jest.fn().mockResolvedValue({ id: 'new-workspace', name: 'Finance' }),
      delete: jest.fn(),
    };
    const memberRepository = { create: jest.fn().mockImplementation(value => value), save: jest.fn().mockResolvedValue(undefined) };
    const manager = {
      getRepository: jest.fn().mockImplementation((target: string) => ({
        insert: jest.fn().mockImplementation(async () => {
          inserted.push(target);
        }),
      })),
      // categories.ledger_account_id -> ledger_accounts, and categories.parent_id -> categories.
      query: jest.fn().mockResolvedValue([
        { source: 'categories', target: 'ledger_accounts' },
        { source: 'categories', target: 'categories' },
      ]),
    };
    const archive = {
      open: jest.fn().mockResolvedValue({
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
        transaction: jest.fn().mockImplementation(callback => callback(manager)),
      } as never,
      workspaceRepository as never,
      memberRepository as never,
      archive as never,
    );

    await service.restore(Buffer.from('archive'), 'backup password', { id: 'user-1', workspaceId: 'workspace-1' } as never);

    expect(inserted).toEqual(['LedgerAccount', 'Category']);
  });
});
