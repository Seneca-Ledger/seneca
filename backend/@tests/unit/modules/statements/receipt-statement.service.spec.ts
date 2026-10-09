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

jest.mock('@/common/utils/file-hash.util');
jest.mock('@/common/utils/file-validator.util');
jest.mock('@/common/utils/filename.util');

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
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(TaxRate),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: {
            findOne: jest.fn(),
          },
        },
        { provide: TaxAssignmentService, useValue: { resolve: jest.fn(async () => ({ taxRateId: null, taxRuleId: null, taxSource: null, taxAmount: null, taxNetAmount: null, taxReverseCharge: false })) } },
        {
          provide: AuditService,
          useValue: {
            createEvent: jest.fn(),
          },
        },
        {
          provide: ReceiptsService,
          useValue: {
            createFromScan: jest.fn(),
            update: jest.fn(),
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

    jest.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('test'));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(workspaceMemberRepository, 'findOne').mockResolvedValue({
      role: WorkspaceRole.ADMIN,
    } as WorkspaceMember);
    jest.spyOn(categoryRepository, 'findOne').mockResolvedValue({
      id: 'cat-1',
      workspaceId: 'ws-1',
      type: 'expense',
      isEnabled: true,
      name: 'Meals',
    } as unknown as Category);
    jest.spyOn(taxRateRepository, 'findOne').mockResolvedValue({
      id: 'tax-1',
      workspaceId: 'ws-1',
      isEnabled: true,
      isDefault: true,
      name: 'VAT',
      rate: 12,
    } as TaxRate);

    const { calculateFileHash } = require('@/common/utils/file-hash.util');
    calculateFileHash.mockResolvedValue('abc123');
    const { getFileTypeFromMime } = require('@/common/utils/file-validator.util');
    getFileTypeFromMime.mockReturnValue(FileType.IMAGE);
    const { normalizeFilename } = require('@/common/utils/filename.util');
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

    jest.spyOn(statementRepository, 'create').mockImplementation((input: any) => input);
    jest
      .spyOn(statementRepository, 'save')
      .mockImplementation(async (input: any) => ({ id: 'stmt-ocr-1', ...input }));
    jest.spyOn(statementRepository, 'update').mockResolvedValue({ affected: 1 } as any);
    jest.spyOn(transactionRepository, 'create').mockImplementation((input: any) => input);
    jest
      .spyOn(transactionRepository, 'save')
      .mockImplementation(async (input: any) => ({ id: 'tx-ocr-1', ...input }));
    jest.spyOn(receiptsService, 'createFromScan').mockResolvedValue({
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

    jest.spyOn(statementRepository, 'create').mockImplementation((input: any) => input);
    jest
      .spyOn(statementRepository, 'save')
      .mockImplementation(async (input: any) => ({ id: 'stmt-nocat-1', ...input }));
    jest.spyOn(statementRepository, 'update').mockResolvedValue({ affected: 1 } as any);
    jest.spyOn(transactionRepository, 'create').mockImplementation((input: any) => input);
    jest
      .spyOn(transactionRepository, 'save')
      .mockImplementation(async (input: any) => ({ id: 'tx-nocat-1', ...input }));
    jest.spyOn(receiptsService, 'createFromScan').mockResolvedValue({
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

    jest.spyOn(statementRepository, 'create').mockImplementation((input: any) => input);
    jest
      .spyOn(statementRepository, 'save')
      .mockImplementation(async (input: any) => ({ id: 'stmt-noamt-1', ...input }));
    jest.spyOn(statementRepository, 'update').mockResolvedValue({ affected: 1 } as any);
    jest.spyOn(transactionRepository, 'create').mockImplementation((input: any) => input);
    jest.spyOn(receiptsService, 'createFromScan').mockResolvedValue({
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
    const file = {
      path: '/tmp/receipt.jpg',
      originalname: 'receipt.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
    } as Express.Multer.File;

    jest.spyOn(receiptsService, 'createFromScan').mockResolvedValue({
      id: 'receipt-failed',
      status: ReceiptStatus.FAILED,
      subject: 'receipt.jpg',
      parsedData: {},
      metadata: {
        processingError: 'OCR engine timeout',
      },
    } as any);

    await expect(
      service.createFromReceiptScan({
        user: mockUser as User,
        workspaceId: 'ws-1',
        files: [file],
      }),
    ).rejects.toThrow(new BadRequestException('OCR engine timeout'));
  });
});
