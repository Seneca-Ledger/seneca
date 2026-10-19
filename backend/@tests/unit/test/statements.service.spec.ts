import * as fs from 'fs';
import { calculateFileHash } from '@/common/utils/file-hash.util';
import { FileType } from '@/entities/statement.entity';
import { StatementsService } from '@/modules/statements/statements.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { workspaceCurrencyStub } from '../../helpers/workspace-currency-stub';

jest.mock('@/common/utils/file-hash.util', () => ({
  calculateFileHash: jest.fn(),
}));

describe('StatementsService', () => {
  // create() оборачивает проверку дубликатов и вставку в транзакцию с advisory-lock;
  // менеджер прокидывает вызовы в тот же мок-репозиторий, чтобы ассерты не менялись.
  const statementRepository: Record<string, any> = {
    create: jest.fn(data => data),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const statementManager = {
    query: jest.fn(),
    getRepository: jest.fn(() => statementRepository),
    transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) => cb(statementManager)),
  };
  statementRepository.manager = statementManager;

  const auditService = { createEvent: jest.fn().mockResolvedValue(undefined) };
  const userRepository = {
    findOne: jest.fn(),
  };
  const workspaceMemberRepository = {
    findOne: jest.fn(),
  };
  const statementProcessingService = {
    processStatement: jest.fn().mockResolvedValue(undefined),
  };
  const receiptStatementService = {
    createFromReceiptScan: jest.fn(),
  };
  const fileStorageService = {};
  const transactionRepository = {};
  const categoryRepository = {};
  const taxRateRepository = {};
  const cacheManager = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  let service: StatementsService;
  let qb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('test'));
    jest.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

    qb = {
      leftJoinAndSelect: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      skip: jest.fn(() => qb),
      take: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      getManyAndCount: jest.fn(async () => [[], 0]),
    };
    statementRepository.createQueryBuilder = jest.fn(() => qb);

    service = new StatementsService(
      statementRepository as any,
      transactionRepository as any,
      userRepository as any,
      categoryRepository as any,
      taxRateRepository as any,
      workspaceMemberRepository as any,
      { findOne: jest.fn(async () => null) } as any,
      fileStorageService as any,
      statementProcessingService as any,
      { enqueue: jest.fn() } as any,
      receiptStatementService as any,
      cacheManager as any,
      auditService as any,
      { resolve: jest.fn(async () => ({})) } as any,
      workspaceCurrencyStub() as never,
      eventEmitter as any,
    );
    jest.spyOn(service as any, 'ensureCanEditStatements').mockResolvedValue(undefined);
  });

  it('orders by createdAt when listing statements', async () => {
    qb.getManyAndCount = jest.fn(async () => [[], 0]);

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
    qb.getManyAndCount = jest.fn(async () => [[], 0]);

    await service.findAll('ws-1', { page: 1, limit: 20 });

    expect(qb.where).toHaveBeenCalledWith('statement.deletedAt IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('statement.workspaceId = :workspaceId', {
      workspaceId: 'ws-1',
    });
  });

  it('creates a new statement even when file hash is duplicated', async () => {
    (calculateFileHash as jest.Mock).mockResolvedValue('same-hash');
    statementRepository.save
      .mockImplementationOnce(async entity => ({ ...entity, id: 'stmt-1' }))
      .mockImplementationOnce(async entity => ({ ...entity, id: 'stmt-2' }));
    statementRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'stmt-1' });

    statementRepository.createQueryBuilder = jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
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
    const pythonSpy = jest
      .spyOn(service as any, 'generateThumbnailWithPython')
      .mockRejectedValue(new Error('python failed'));
    const quickLookSpy = jest
      .spyOn(service as any, 'generateThumbnailWithQuickLook')
      .mockResolvedValue('/tmp/statement.pdf.png');

    statementRepository.createQueryBuilder = jest.fn(() => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 'stmt-thumb',
        workspaceId: 'ws-1',
        fileType: FileType.PDF,
        fileName: 'statement.pdf',
        fileData: Buffer.from('%PDF-1.4'),
        updatedAt: new Date('2026-03-17T00:00:00.000Z'),
      }),
    }));
    (fileStorageService as any).getFileAvailability = jest.fn().mockResolvedValue({
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

    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined as any);
    cacheManager.get.mockResolvedValue(null);
    (fs.promises.readFile as jest.Mock).mockResolvedValue(Buffer.from('png-data'));
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
