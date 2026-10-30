import type { Mock } from 'vitest';
import * as fs from 'fs';
import { calculateFileHash } from '@/common/utils/file-hash.util';
import { FileType } from '@/entities/statement.entity';
import { StatementsService } from '@/modules/statements/statements.service';
import { StatementFilesService } from '@/modules/statements/statement-files.service';
import { StatementListService } from '@/modules/statements/statement-list.service';
import { StatementUploadService } from '@/modules/statements/statement-upload.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { workspaceCurrencyStub } from '../../helpers/workspace-currency-stub';

vi.mock('@/common/utils/file-hash.util', () => ({
  calculateFileHash: vi.fn(),
}));

describe('StatementsService', () => {
  // create() оборачивает проверку дубликатов и вставку в транзакцию с advisory-lock;
  // менеджер прокидывает вызовы в тот же мок-репозиторий, чтобы ассерты не менялись.
  const statementRepository: Record<string, any> = {
    create: vi.fn(data => data),
    save: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  const statementManager = {
    query: vi.fn(),
    getRepository: vi.fn(() => statementRepository),
    transaction: vi.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(statementManager)),
  };
  statementRepository.manager = statementManager;

  const auditService = { createEvent: vi.fn().mockResolvedValue(undefined) };
  const userRepository = {
    findOne: vi.fn(),
  };
  const workspaceMemberRepository = {
    findOne: vi.fn(),
  };
  const statementProcessingService = {
    processStatement: vi.fn().mockResolvedValue(undefined),
  };
  const receiptStatementService = {
    createFromReceiptScan: vi.fn(),
  };
  const fileStorageService = {};
  const transactionRepository = {};
  const categoryRepository = {};
  const cacheManager = { get: vi.fn(), set: vi.fn(), del: vi.fn() };
  const eventEmitter = { emit: vi.fn() };

  let service: StatementsService;

  let statementFiles: StatementFilesService;
  let qb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('test'));
    vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

    qb = {
      leftJoinAndSelect: vi.fn(() => qb),
      orderBy: vi.fn(() => qb),
      skip: vi.fn(() => qb),
      take: vi.fn(() => qb),
      where: vi.fn(() => qb),
      andWhere: vi.fn(() => qb),
      getManyAndCount: vi.fn(async () => [[], 0]),
    };
    statementRepository.createQueryBuilder = vi.fn(() => qb);

    statementFiles = new StatementFilesService(fileStorageService as any, cacheManager as any);
    const wallets = { findOne: vi.fn(async () => null) } as any;
    const parsingQueue = { enqueue: vi.fn() } as any;
    service = new StatementsService(
      statementRepository as any,
      transactionRepository as any,
      userRepository as any,
      workspaceMemberRepository as any,
      statementProcessingService as any,
      parsingQueue,
      receiptStatementService as any,
      auditService as any,
      statementFiles,
      {} as any,
      {} as any,
      new StatementUploadService(
        statementRepository as any,
        workspaceMemberRepository as any,
        wallets,
        parsingQueue,
        cacheManager as any,
        auditService as any,
        workspaceCurrencyStub() as never,
        eventEmitter as any,
      ),
      {} as any,
      new StatementListService(
        statementRepository as any,
        transactionRepository as any,
        categoryRepository as any,
        fileStorageService as any,
      ),
    );
  });

  it('orders by createdAt when listing statements', async () => {
    qb.getManyAndCount = vi.fn(async () => [[], 0]);

    const result = await service.findAll('ws-1', { page: 1, limit: 20 });

    expect(statementRepository.createQueryBuilder).toHaveBeenCalledWith('statement');
    expect(qb.orderBy).toHaveBeenCalledWith('statement.createdAt', 'DESC');
    expect(qb.where).toHaveBeenCalledWith('statement.deletedAt IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('statement.workspaceId = :workspaceId', {
      workspaceId: 'ws-1',
    });
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('filters by workspace when user is in workspace', async () => {
    qb.getManyAndCount = vi.fn(async () => [[], 0]);

    await service.findAll('ws-1', { page: 1, limit: 20 });

    expect(qb.where).toHaveBeenCalledWith('statement.deletedAt IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('statement.workspaceId = :workspaceId', {
      workspaceId: 'ws-1',
    });
  });

  it('creates a new statement even when file hash is duplicated', async () => {
    (calculateFileHash as Mock).mockResolvedValue('same-hash');
    statementRepository.save
      .mockImplementationOnce(async entity => ({ ...entity, id: 'stmt-1' }))
      .mockImplementationOnce(async entity => ({ ...entity, id: 'stmt-2' }));
    statementRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'stmt-1' });

    statementRepository.createQueryBuilder = vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    }));

    const file = {
      path: '/tmp/file-1.pdf',
      originalname: 'file.pdf',
      mimetype: 'application/pdf',
      size: 123,
    } as any;

    const user = { id: 'user-1' } as any;
    await service.create(user, 'ws-1', file);
    await expect(service.create(user, 'ws-1', file)).rejects.toThrow();
  });

  it('falls back to qlmanage when python thumbnail generation fails on darwin', async () => {
    const originalPlatform = process.platform;
    const pythonSpy = vi
      .spyOn(statementFiles as any, 'generateThumbnailWithPython')
      .mockRejectedValue(new Error('python failed'));
    const quickLookSpy = vi
      .spyOn(statementFiles as any, 'generateThumbnailWithQuickLook')
      .mockResolvedValue('/tmp/statement.pdf.png');

    statementRepository.createQueryBuilder = vi.fn(() => ({
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({
        id: 'stmt-thumb',
        workspaceId: 'ws-1',
        fileType: FileType.PDF,
        fileName: 'statement.pdf',
        fileData: Buffer.from('%PDF-1.4'),
        updatedAt: new Date('2026-03-17T00:00:00.000Z'),
      }),
    }));
    (fileStorageService as any).getFileAvailability = vi.fn().mockResolvedValue({
      onDisk: true,
      inDb: false,
    });

    statementRepository.findOne.mockResolvedValue({
      id: 'stmt-thumb',
      workspaceId: 'ws-1',
      fileType: FileType.PDF,
      fileName: 'statement.pdf',
      fileData: Buffer.from('%PDF-1.4'),
      updatedAt: new Date('2026-03-17T00:00:00.000Z'),
    } as any);

    vi.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined as any);
    cacheManager.get.mockResolvedValue(null);
    (fs.promises.readFile as Mock).mockResolvedValue(Buffer.from('png-data'));
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    try {
      const result = await service.getThumbnail('stmt-thumb', 'ws-1', 200);

      expect(result).toEqual(Buffer.from('png-data'));
      expect(pythonSpy).toHaveBeenCalledTimes(1);
      expect(quickLookSpy).toHaveBeenCalledWith(expect.any(String), '/tmp', 200);
      expect(cacheManager.set).toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });
});
