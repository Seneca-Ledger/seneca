/// <reference types="vitest/globals" />

import { StatementStage, StatementStatus } from '@/entities/statement.entity';
import { StatementSiblingsService } from '@/modules/parsing/services/statement-siblings.service';

const UPLOAD = {
  id: 'upload-1',
  userId: 'user-1',
  workspaceId: 'workspace-1',
  folderId: null,
  fileName: 'example-statement.pdf',
  filePath: 'uploads/example-statement.pdf',
  fileType: 'pdf',
  fileSize: 1000,
  fileHash: 'hash-1',
  bankName: 'other',
  stage: StatementStage.SUBMIT,
  walletId: 'wallet-hkd',
  sourceStatementId: null,
  parsingDetails: {
    otherAccounts: [
      { index: 1, accountNumber: '000-0002', currency: 'USD', transactions: 10 },
      { index: 2, accountNumber: '', currency: 'EUR', transactions: 3 },
    ],
  },
};

describe('StatementSiblingsService', () => {
  const statements = {
    findOne: vi.fn(),
    find: vi.fn(async () => [] as Array<{ id: string; sourceAccountIndex: number }>),
    create: vi.fn((value: object) => value),
    save: vi.fn(async (value: object) => ({ ...value, id: `sibling-${statements.save.mock.calls.length}` })),
  };
  const queue = { enqueue: vi.fn(async () => undefined) };
  const service = () => new StatementSiblingsService(statements as never, queue as never);

  beforeEach(() => {
    vi.clearAllMocks();
    statements.findOne.mockResolvedValue(UPLOAD);
  });

  it('makes a statement on the same file for each other account and queues it', async () => {
    const created = await service().importOtherAccounts(UPLOAD.id);

    expect(created).toHaveLength(2);
    expect(statements.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: UPLOAD.workspaceId,
        filePath: UPLOAD.filePath,
        fileHash: UPLOAD.fileHash,
        status: StatementStatus.UPLOADED,
        accountNumber: '000-0002',
        currency: 'USD',
        walletId: null,
        sourceStatementId: UPLOAD.id,
        sourceAccountIndex: 1,
      }),
    );
    expect(statements.create).toHaveBeenCalledWith(
      expect.objectContaining({ accountNumber: null, currency: 'EUR', sourceAccountIndex: 2 }),
    );
    expect(queue.enqueue.mock.calls).toEqual([['sibling-1'], ['sibling-2']]);
  });

  it('looks for existing ones within the upload’s workspace and skips them', async () => {
    statements.find.mockResolvedValueOnce([{ id: 'sibling-old', sourceAccountIndex: 1 }]);

    const created = await service().importOtherAccounts(UPLOAD.id);

    expect(statements.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: UPLOAD.workspaceId, sourceStatementId: UPLOAD.id },
      }),
    );
    expect(created.map(statement => statement.sourceAccountIndex)).toEqual([2]);
    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('makes none for a statement that is itself one of the other accounts', async () => {
    statements.findOne.mockResolvedValueOnce({ ...UPLOAD, sourceStatementId: 'upload-0' });

    expect(await service().importOtherAccounts(UPLOAD.id)).toEqual([]);
    expect(statements.save).not.toHaveBeenCalled();
  });

  it('makes none when the file prints one account', async () => {
    statements.findOne.mockResolvedValueOnce({ ...UPLOAD, parsingDetails: {} });

    expect(await service().importOtherAccounts(UPLOAD.id)).toEqual([]);
    expect(queue.enqueue).not.toHaveBeenCalled();
  });
});
