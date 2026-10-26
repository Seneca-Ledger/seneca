import type { Mock } from 'vitest';
import { appError } from '@/common/errors/app-error';
import * as filenameUtil from '@/common/utils/filename.util';
import * as fileValidatorUtil from '@/common/utils/file-validator.util';
import * as fileHashUtil from '@/common/utils/file-hash.util';
import * as fs from 'fs';
import { Category } from '@/entities/category.entity';
import { ReceiptStatus } from '@/entities/receipt.entity';
import { BankName, FileType, Statement, StatementStatus } from '@/entities/statement.entity';
import { TaxRate } from '@/entities/tax-rate.entity';
import { Transaction } from '@/entities/transaction.entity';
import { User, UserRole } from '@/entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '@/entities/workspace-member.entity';
import { AuditService } from '@/modules/audit/audit.service';
import { ReceiptsService } from '@/modules/receipts/receipts.service';
import { ReceiptStatementService } from '@/modules/statements/services/receipt-statement.service';
import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { TaxAssignmentService } from '@/modules/tax/tax-assignment.service';

vi.mock('@/common/utils/file-hash.util');
vi.mock('@/common/utils/file-validator.util');
vi.mock('@/common/utils/filename.util');

describe('ReceiptStatementService', () => {
  let testingModule: TestingModule;
  let service: ReceiptStatementService;
  let statementRepository: Repository<Statement>;
  let transactionRepository: Repository<Transaction>;
  let categoryRepository: Repository<Category>;
  let taxRateRepository: Repository<TaxRate>;
  let workspaceMemberRepository: Repository<WorkspaceMember>;
  let receiptsService: ReceiptsService;

  const mockUser: Partial<User> = {
    id: '1',
    email: 'test@example.com',
    name: 'Test User',
    role: UserRole.USER,
    workspaceId: 'ws-1',
    isActive: true,
  };

  beforeAll(async () => {
    testingModule = await Test.createTestingModule({
      providers: [
        ReceiptStatementService,
        {
          provide: getRepositoryToken(Statement),
          useValue: {
            create: vi.fn(),
            save: vi.fn(),
            update: vi.fn(),
            findOne: vi.fn(),
            manager: { transaction: vi.fn() },
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: vi.fn(),
            save: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            findOne: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(TaxRate),
          useValue: {
            findOne: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: {
            findOne: vi.fn(),
          },
        },
        { provide: TaxAssignmentService, useValue: { resolve: vi.fn(async () => ({ taxRateId: null, taxRuleId: null, taxSource: null, taxAmount: null, taxNetAmount: null, taxReverseCharge: false })) } },
        {
          provide: AuditService,
          useValue: {
            createEvent: vi.fn(),
          },
        },
        {
          provide: ReceiptsService,
          useValue: {
            createFromScan: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
          },
        },
      ],
    }).compile();

    service = testingModule.get<ReceiptStatementService>(ReceiptStatementService);
    statementRepository = testingModule.get<Repository<Statement>>(getRepositoryToken(Statement));
    transactionRepository = testingModule.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    categoryRepository = testingModule.get<Repository<Category>>(getRepositoryToken(Category));
    taxRateRepository = testingModule.get<Repository<TaxRate>>(getRepositoryToken(TaxRate));
    workspaceMemberRepository = testingModule.get<Repository<WorkspaceMember>>(
      getRepositoryToken(WorkspaceMember),
    );
    receiptsService = testingModule.get<ReceiptsService>(ReceiptsService);

    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('test'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
      role: WorkspaceRole.ADMIN,
    } as WorkspaceMember);
    vi.spyOn(categoryRepository, 'findOne').mockResolvedValue({
      id: 'cat-1',
      workspaceId: 'ws-1',
      type: 'expense',
      isEnabled: true,
      name: 'Meals',
    } as unknown as Category);
    vi.spyOn(taxRateRepository, 'findOne').mockResolvedValue({
      id: 'tax-1',
      workspaceId: 'ws-1',
      isEnabled: true,
      isDefault: true,
      name: 'VAT',
      rate: 12,
    } as TaxRate);

    vi.spyOn(statementRepository, 'findOne').mockResolvedValue(null);
    (statementRepository.manager.transaction as Mock).mockImplementation(
      async (work: (manager: unknown) => unknown) =>
        work({ query: vi.fn(), getRepository: () => statementRepository }),
    );

    const { calculateFileHash } = vi.mocked(fileHashUtil);
    calculateFileHash.mockResolvedValue('abc123');
    const { getFileTypeFromMime } = vi.mocked(fileValidatorUtil);
    getFileTypeFromMime.mockReturnValue(FileType.IMAGE);
    const { normalizeFilename } = vi.mocked(filenameUtil);
    normalizeFilename.mockReturnValue('receipt.jpg');
  });

  afterAll(async () => {
    await testingModule.close();
  });

  it('creates a completed statement and verified transaction from receipt OCR data', async () => {
    const file = {
      path: '/tmp/receipt.jpg',
      originalname: 'receipt.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
    } as Express.Multer.File;

    vi.spyOn(statementRepository, 'create').mockImplementation((input: any) => input);
    vi
      .spyOn(statementRepository, 'save')
      .mockImplementation(async (input: any) => ({ id: 'stmt-ocr-1', ...input }));
    vi.spyOn(statementRepository, 'update').mockResolvedValue({ affected: 1 } as any);
    vi.spyOn(transactionRepository, 'create').mockImplementation((input: any) => input);
    vi
      .spyOn(transactionRepository, 'save')
      .mockImplementation(async (input: any) => ({ id: 'tx-ocr-1', ...input }));
    vi.spyOn(receiptsService, 'createFromScan').mockResolvedValue({
      id: 'receipt-1',
      status: ReceiptStatus.DRAFT,
      subject: 'receipt.jpg',
      parsedData: {
        amount: 4590,
        currency: 'KZT',
        vendor: 'Magnum',
        date: '2026-03-27',
        categoryId: 'cat-1',
        confidence: 0.91,
        validationIssues: [],
        transactionType: 'expense',
      },
      extractionMethod: 'ocr_hybrid',
      metadata: {},
    } as any);

    const result = await service.createFromReceiptScan({
      user: mockUser as User,
      workspaceId: 'ws-1',
      files: [file],
      language: 'ru',
    });

    expect(receiptsService.createFromScan).toHaveBeenCalledWith({
      userId: '1',
      workspaceId: 'ws-1',
      file,
      language: 'ru',
    });
    expect(statementRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bankName: BankName.OTHER,
        status: StatementStatus.COMPLETED,
        totalTransactions: 1,
        totalDebit: 4590,
        currency: 'KZT',
        categoryId: 'cat-1',
      }),
    );
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        statementId: 'stmt-ocr-1',
        debit: 4590,
        amount: 4590,
        currency: 'KZT',
        counterpartyName: 'Magnum',
        categoryId: 'cat-1',
        taxRateId: 'tax-1',
      }),
    );
    expect(receiptsService.update).toHaveBeenCalledWith('receipt-1', 'ws-1', {
      statementId: 'stmt-ocr-1',
    });
    expect(result).toEqual([expect.objectContaining({ id: 'stmt-ocr-1' })]);
  });

  it('leaves the scan uncategorised when the receipt names no category', async () => {
    const file = {
      path: '/tmp/receipt.jpg',
      originalname: 'receipt.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
    } as Express.Multer.File;

    vi.spyOn(statementRepository, 'create').mockImplementation((input: any) => input);
    vi
      .spyOn(statementRepository, 'save')
      .mockImplementation(async (input: any) => ({ id: 'stmt-nocat-1', ...input }));
    vi.spyOn(statementRepository, 'update').mockResolvedValue({ affected: 1 } as any);
    vi.spyOn(transactionRepository, 'create').mockImplementation((input: any) => input);
    vi
      .spyOn(transactionRepository, 'save')
      .mockImplementation(async (input: any) => ({ id: 'tx-nocat-1', ...input }));
    vi.spyOn(receiptsService, 'createFromScan').mockResolvedValue({
      id: 'receipt-3',
      status: ReceiptStatus.DRAFT,
      subject: 'receipt.jpg',
      parsedData: {
        amount: 1463,
        currency: 'USD',
        vendor: 'Invoice 295560440015',
        date: '2026-10-04',
        validationIssues: [],
        transactionType: 'expense',
      },
      extractionMethod: 'ocr_hybrid',
      metadata: {},
    } as any);

    await service.createFromReceiptScan({
      user: mockUser as User,
      workspaceId: 'ws-1',
      files: [file],
    });

    // No guess: an arbitrary enabled expense category used to land here and
    // showed up in Review as though someone had picked it.
    expect(categoryRepository.findOne).not.toHaveBeenCalled();
    expect(statementRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: null }),
    );
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: null }),
    );
  });

  it('creates an uploaded statement without transaction when amount is missing', async () => {
    const file = {
      path: '/tmp/receipt.pdf',
      originalname: 'receipt.pdf',
      mimetype: 'application/pdf',
      size: 2048,
    } as Express.Multer.File;

    vi.spyOn(statementRepository, 'create').mockImplementation((input: any) => input);
    vi
      .spyOn(statementRepository, 'save')
      .mockImplementation(async (input: any) => ({ id: 'stmt-noamt-1', ...input }));
    vi.spyOn(statementRepository, 'update').mockResolvedValue({ affected: 1 } as any);
    vi.spyOn(transactionRepository, 'create').mockImplementation((input: any) => input);
    vi.spyOn(receiptsService, 'createFromScan').mockResolvedValue({
      id: 'receipt-2',
      status: ReceiptStatus.DRAFT,
      subject: 'receipt.pdf',
      parsedData: {
        vendor: 'Some Store',
        date: '2026-05-06',
        currency: 'KZT',
        confidence: 0.3,
        validationIssues: [],
      },
      extractionMethod: 'regex',
      metadata: {},
    } as any);

    const result = await service.createFromReceiptScan({
      user: mockUser as User,
      workspaceId: 'ws-1',
      files: [file],
    });

    expect(statementRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: StatementStatus.UPLOADED,
        totalTransactions: 0,
        totalDebit: 0,
      }),
    );
    expect(transactionRepository.create).not.toHaveBeenCalled();
    expect(result).toEqual([expect.objectContaining({ id: 'stmt-noamt-1' })]);
  });

  it('surfaces receipt processing errors from OCR metadata', async () => {
    const reason = 'OCR engine timeout';
    const file = {
      path: '/tmp/receipt.jpg',
      originalname: 'receipt.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
    } as Express.Multer.File;

    vi.spyOn(receiptsService, 'createFromScan').mockResolvedValue({
      id: 'receipt-failed',
      status: ReceiptStatus.FAILED,
      subject: 'receipt.jpg',
      parsedData: {},
      metadata: {
        processingError: reason,
      },
    } as any);

    await expect(
      service.createFromReceiptScan({
        user: mockUser as User,
        workspaceId: 'ws-1',
        files: [file],
      }),
    ).rejects.toThrow(new BadRequestException(appError('RECEIPT_SCAN_FAILED', { reason })));
  });
  describe('the same file again', () => {
    const file = {
      path: '/tmp/invoice.pdf',
      originalname: 'invoice.pdf',
      mimetype: 'application/pdf',
      size: 2048,
    } as Express.Multer.File;
    const filed = { id: 'stmt-filed', fileHash: 'abc123' } as Statement;

    it('hands back the document already filed instead of booking it again', async () => {
      vi.spyOn(statementRepository, 'findOne').mockResolvedValue(filed);
      const unlink = vi.spyOn(fs.promises, 'unlink').mockResolvedValue(undefined);

      const result = await service.createFromReceiptScan({
        user: mockUser as User,
        workspaceId: 'ws-1',
        files: [file],
      });

      expect(result).toEqual([filed]);
      expect(statementRepository.findOne).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1', fileHash: 'abc123', deletedAt: expect.anything() },
      });
      expect(receiptsService.createFromScan).not.toHaveBeenCalled();
      expect(transactionRepository.create).not.toHaveBeenCalled();
      expect(unlink).toHaveBeenCalledWith('/tmp/invoice.pdf');
    });

    it('drops its own copy when the same file was filed while it was being read', async () => {
      vi
        .spyOn(statementRepository, 'findOne')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(filed);
      vi.spyOn(statementRepository, 'create').mockImplementation((input: any) => input);
      vi.spyOn(receiptsService, 'createFromScan').mockResolvedValue({
        id: 'receipt-raced',
        status: ReceiptStatus.DRAFT,
        subject: 'invoice.pdf',
        parsedData: { amount: 5, currency: 'USD', vendor: 'Anomaly', validationIssues: [] },
        metadata: {},
      } as any);

      const result = await service.createFromReceiptScan({
        user: mockUser as User,
        workspaceId: 'ws-1',
        files: [file],
      });

      expect(result).toEqual([filed]);
      expect(statementRepository.save).not.toHaveBeenCalled();
      expect(transactionRepository.create).not.toHaveBeenCalled();
      expect(receiptsService.delete).toHaveBeenCalledWith('receipt-raced', 'ws-1', '1');
    });
  });
});
