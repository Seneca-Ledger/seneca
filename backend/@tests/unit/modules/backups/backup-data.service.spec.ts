import { BackupDataService } from '../../../../src/modules/backups/backup-data.service';
import { Readable } from 'node:stream';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';

describe('BackupDataService', () => {
  it('exports workspace-scoped business records but strips encrypted secrets and integrations', async () => {
    const categories = { find: jest.fn().mockResolvedValue([{ id: 'cat-1', workspaceId: 'ws-1', name: 'Travel' }]) };
    const serviceSettings = {
      find: jest.fn().mockResolvedValue([
        {
          id: 'setting-1',
          workspaceId: 'ws-1',
          key: 'smtp',
          config: { host: 'mail.example.com' },
          encryptedSecrets: { token: 'enc:secret' },
        },
      ]),
    };
    const integrations = { find: jest.fn() };
    const repositories = new Map([
      ['Category', categories],
      ['WorkspaceServiceSettings', serviceSettings],
      ['Integration', integrations],
    ]);
    const service = new BackupDataService({
      entityMetadatas: [
        metadata('categories', 'Category', ['id', 'workspaceId', 'name']),
        metadata('workspace_service_settings', 'WorkspaceServiceSettings', [
          'id',
          'workspaceId',
          'key',
          'config',
          'encryptedSecrets',
        ]),
        metadata('integrations', 'Integration', ['id', 'workspaceId', 'provider']),
      ],
      getRepository: (target: string) => repositories.get(target),
    } as never);

    const snapshot = await service.collect('ws-1');

    expect(snapshot.collections.categories).toEqual([{ id: 'cat-1', workspaceId: 'ws-1', name: 'Travel' }]);
    expect(snapshot.collections.workspace_service_settings).toEqual([
      { id: 'setting-1', workspaceId: 'ws-1', key: 'smtp', config: { host: 'mail.example.com' } },
    ]);
    expect(snapshot.collections.integrations).toBeUndefined();
    expect(snapshot.files).toEqual([]);
    expect(integrations.find).not.toHaveBeenCalled();
  });

  it('adds original statement files and replaces local paths with portable backup paths', async () => {
    const statements = {
      find: jest.fn().mockResolvedValue([
        { id: 'statement-1', workspaceId: 'ws-1', fileName: 'bank.csv', filePath: '/uploads/bank.csv' },
      ]),
    };
    const service = new BackupDataService(
      {
        entityMetadatas: [metadata('statements', 'Statement', ['id', 'workspaceId', 'fileName', 'filePath'])],
        getRepository: () => statements,
      } as never,
      {
        getStatementFileStream: jest.fn().mockResolvedValue({
          stream: Readable.from(Buffer.from('date,amount\n')),
          fileName: 'bank.csv',
        }),
      } as never,
    );

    const snapshot = await service.collect('ws-1');

    expect(snapshot.collections.statements).toEqual([
      {
        id: 'statement-1',
        workspaceId: 'ws-1',
        fileName: 'bank.csv',
        filePath: 'statements/statement-1/bank.csv',
      },
    ]);
    expect(snapshot.files).toEqual([
      { path: 'statements/statement-1/bank.csv', contents: Buffer.from('date,amount\n') },
    ]);
  });

  it('includes receipt attachments and replaces machine-specific attachment paths', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'seneca-receipt-'));
    const attachment = path.join(directory, 'receipt.jpg');
    await fs.writeFile(attachment, 'receipt image');
    const receipts = {
      find: jest.fn().mockResolvedValue([
        { id: 'receipt-1', workspaceId: 'ws-1', attachmentPaths: [attachment], subject: 'Taxi' },
      ]),
    };
    const service = new BackupDataService({
      entityMetadatas: [metadata('receipts', 'Receipt', ['id', 'workspaceId', 'attachmentPaths', 'subject'])],
      getRepository: () => receipts,
    } as never);

    const snapshot = await service.collect('ws-1');

    expect(snapshot.collections.receipts).toEqual([
      {
        id: 'receipt-1',
        workspaceId: 'ws-1',
        attachmentPaths: ['receipts/receipt-1/0-receipt.jpg'],
        subject: 'Taxi',
      },
    ]);
    expect(snapshot.files).toEqual([
      { path: 'receipts/receipt-1/0-receipt.jpg', contents: Buffer.from('receipt image') },
    ]);
    await fs.rm(directory, { recursive: true, force: true });
  });

  it('includes statement file versions with binary data encoded for JSON', async () => {
    const statements = { find: jest.fn().mockResolvedValue([{ id: 'statement-1', workspaceId: 'ws-1' }]) };
    const versions = {
      find: jest.fn().mockResolvedValue([
        { id: 'version-1', statementId: 'statement-1', createdBy: 'old-user', fileData: Buffer.from('original') },
      ]),
    };
    const repositories = new Map([
      ['Statement', statements],
      ['FileVersion', versions],
    ]);
    const service = new BackupDataService({
      entityMetadatas: [
        metadata('statements', 'Statement', ['id', 'workspaceId']),
        metadata('file_versions', 'FileVersion', ['id', 'statementId', 'createdBy', 'fileData']),
      ],
      getRepository: (target: string) => repositories.get(target),
    } as never);

    const snapshot = await service.collect('ws-1');

    expect(snapshot.collections.file_versions).toEqual([
      {
        id: 'version-1',
        statementId: 'statement-1',
        createdBy: 'old-user',
        fileData: { encoding: 'base64', value: Buffer.from('original').toString('base64') },
      },
    ]);
  });
});

function metadata(tableName: string, target: string, properties: string[]) {
  return {
    tableName,
    target,
    columns: properties.map(propertyName => ({ propertyName })),
    primaryColumns: [{ propertyName: 'id' }],
  };
}
