import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { TransactionAttachmentsService } from '@/modules/transactions/services/transaction-attachments.service';
import { NotFoundException } from '@nestjs/common';

const createRepoMock = () =>
  ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    exists: jest.fn().mockResolvedValue(true),
    create: jest.fn((data: unknown) => data),
    save: jest.fn(async (entity: unknown) => entity),
    remove: jest.fn(async (entity: unknown) => entity),
  }) as any;

const makeFile = (overrides: Partial<Express.Multer.File> = {}): Express.Multer.File =>
  ({
    originalname: 'receipt.png',
    mimetype: 'image/png',
    size: 12,
    buffer: Buffer.from('fake-png-bytes'),
    ...overrides,
  }) as Express.Multer.File;

describe('TransactionAttachmentsService', () => {
  const attachmentRepo = createRepoMock();
  const transactionRepo = createRepoMock();
  let service: TransactionAttachmentsService;
  let uploadsDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    attachmentRepo.create.mockImplementation((data: unknown) => data);
    attachmentRepo.save.mockImplementation(async (entity: unknown) => entity);
    transactionRepo.exists.mockResolvedValue(true);

    uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seneca-attachments-test-'));
    process.env.UPLOADS_DIR = uploadsDir;

    service = new TransactionAttachmentsService(attachmentRepo, transactionRepo);
  });

  afterEach(() => {
    process.env.UPLOADS_DIR = undefined;
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  it('refuses to attach to a transaction outside the workspace', async () => {
    transactionRepo.exists.mockResolvedValue(false);

    await expect(
      service.create('tx-1', 'ws-1', 'user-1', makeFile()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('never lets the uploaded name reach the filesystem path', async () => {
    const saved = await service.create(
      'tx-1',
      'ws-1',
      'user-1',
      makeFile({ originalname: '../../../../etc/passwd.png' }),
    );

    // Display name is stripped to a basename; the on-disk name is generated.
    expect(saved.fileName).toBe('passwd.png');
    expect(saved.storedFileName).not.toContain('/');
    expect(saved.storedFileName).not.toContain('..');
    expect(saved.storedFileName.endsWith('.png')).toBe(true);

    const written = fs.readdirSync(path.join(uploadsDir, 'transaction-attachments'));
    expect(written).toEqual([saved.storedFileName]);
  });

  it('reports a missing blob instead of streaming a nonexistent path', async () => {
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1',
      workspaceId: 'ws-1',
      storedFileName: 'not-on-disk.png',
      fileName: 'receipt.png',
      mimeType: 'image/png',
    });

    await expect(service.getForDownload('att-1', 'ws-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('deletes the row even when the blob is already gone', async () => {
    attachmentRepo.findOne.mockResolvedValue({
      id: 'att-1',
      workspaceId: 'ws-1',
      storedFileName: 'not-on-disk.png',
    });

    await expect(service.remove('att-1', 'ws-1')).resolves.toBeUndefined();
    expect(attachmentRepo.remove).toHaveBeenCalled();
  });
});
