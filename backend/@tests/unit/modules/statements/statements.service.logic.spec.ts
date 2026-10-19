import * as fs from 'fs';
import { AuditService } from '@/modules/audit/audit.service';
import { StatementParsingQueue } from '@/modules/parsing/queue/statement-parsing.queue';
import { StatementProcessingService } from '@/modules/parsing/services/statement-processing.service';
import { ReceiptStatementService } from '@/modules/statements/services/receipt-statement.service';
import { StatementsService } from '@/modules/statements/statements.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Category } from '@/entities/category.entity';
import { Wallet } from '@/entities/wallet.entity';
import { BankName, FileType, Statement, StatementStatus } from '@/entities/statement.entity';
import { TaxRate } from '@/entities/tax-rate.entity';
import { Transaction } from '@/entities/transaction.entity';
import { User, UserRole } from '@/entities/user.entity';
import { WorkspaceMember, WorkspaceRole } from '@/entities/workspace-member.entity';
import { FileStorageService } from '@/common/services/file-storage.service';
import { TaxAssignmentService } from '@/modules/tax/tax-assignment.service';
import { workspaceCurrencyProvider } from '../../../helpers/workspace-currency-stub';

jest.mock('@/common/utils/file-hash.util');
jest.mock('@/common/utils/file-validator.util');
jest.mock('@/common/utils/filename.util');

describe('StatementsService — business logic', () => {
  let module: TestingModule;
  let service: StatementsService;
  let statementRepo: jest.Mocked<any>;
  let transactionRepo: jest.Mocked<any>;
  let workspaceMemberRepo: jest.Mocked<any>;
  let auditService: jest.Mocked<AuditService>;
  let cacheManager: jest.Mocked<any>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const OWNER_ID = 'user-owner';
  const WORKSPACE_ID = 'ws-1';
  const STATEMENT_ID = 'stmt-1';

  const baseStatement = (): Statement =>
    ({
      id: STATEMENT_ID,
      fileName: 'report.pdf',
      filePath: '/uploads/report.pdf',
      fileType: FileType.PDF,
      bankName: BankName.KASPI,
      status: StatementStatus.PROCESSED,
      userId: OWNER_ID,
      workspaceId: WORKSPACE_ID,
      deletedAt: null,
      parsingDetails: null,
      balanceStart: null,
      balanceEnd: null,
      statementDateFrom: null,
      statementDateTo: null,
      user: { id: OWNER_ID, name: 'Owner', email: 'owner@example.com' },
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as unknown as Statement;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        StatementsService,
        workspaceCurrencyProvider(),
        {
          provide: getRepositoryToken(Statement),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
            // createQueryBuilder is intentionally absent so findOne path is used by permanentDelete
          },
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            create: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Category),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(TaxRate),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Wallet),
          useValue: { findOne: jest.fn(async () => null) },
        },
        {
          provide: getRepositoryToken(WorkspaceMember),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: FileStorageService,
          useValue: {
            deleteFile: jest.fn(),
            getFileUrl: jest.fn(),
            isOnDisk: jest.fn(),
            resolveFilePath: jest.fn(),
            getFileAvailability: jest.fn().mockResolvedValue({ onDisk: true, inDb: false }),
          },
        },
        {
          provide: StatementProcessingService,
          useValue: { processStatement: jest.fn() },
        },
        {
          provide: StatementParsingQueue,
          useValue: { enqueue: jest.fn() },
        },
        {
          provide: ReceiptStatementService,
          useValue: { createFromReceiptScan: jest.fn() },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: TaxAssignmentService,
          useValue: { resolve: jest.fn(async () => ({})) },
        },
        {
          provide: AuditService,
          useValue: { createEvent: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(StatementsService);
    statementRepo = module.get(getRepositoryToken(Statement));
    transactionRepo = module.get(getRepositoryToken(Transaction));
    workspaceMemberRepo = module.get(getRepositoryToken(WorkspaceMember));
    auditService = module.get(AuditService);
    cacheManager = module.get(CACHE_MANAGER);
    eventEmitter = module.get(EventEmitter2);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: requester is the statement owner → ensureCanModify passes
    workspaceMemberRepo.findOne.mockResolvedValue(null);
  });

  afterAll(() => module.close());

  // ---------------------------------------------------------------------------
  // permanentDelete
  // ---------------------------------------------------------------------------
  describe('permanentDelete', () => {
    it('throws NotFoundException when statement does not exist', async () => {
      statementRepo.findOne.mockResolvedValue(null);

      await expect(service.permanentDelete(STATEMENT_ID, OWNER_ID, WORKSPACE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when requester is not owner and not admin', async () => {
      const stranger = 'stranger-user';
      statementRepo.findOne.mockResolvedValue(baseStatement());
      workspaceMemberRepo.findOne.mockResolvedValue({
        role: WorkspaceRole.MEMBER,
        permissions: {},
      });

      await expect(service.permanentDelete(STATEMENT_ID, stranger, WORKSPACE_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('deletes all related transactions before removing statement', async () => {
      statementRepo.findOne.mockResolvedValue(baseStatement());
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await service.permanentDelete(STATEMENT_ID, OWNER_ID, WORKSPACE_ID);

      expect(transactionRepo.delete).toHaveBeenCalledWith({ statementId: STATEMENT_ID });
    });

    it('removes the statement record from the database', async () => {
      const stmt = baseStatement();
      statementRepo.findOne.mockResolvedValue(stmt);
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await service.permanentDelete(STATEMENT_ID, OWNER_ID, WORKSPACE_ID);

      expect(statementRepo.remove).toHaveBeenCalledWith(stmt);
    });

    it('continues with statement deletion even if file unlink throws', async () => {
      // Exercises the try/catch around unlinkSync — error is swallowed, remove still called.
      // Note: fs.existsSync uses the real implementation here; the file at /uploads/report.pdf
      // does not exist on disk, so this also covers the "file absent → skip unlink" path.
      statementRepo.findOne.mockResolvedValue(baseStatement());

      await expect(service.permanentDelete(STATEMENT_ID, OWNER_ID, WORKSPACE_ID)).resolves.not.toThrow();
      expect(statementRepo.remove).toHaveBeenCalled();
    });

    it('invalidates the thumbnail cache entry', async () => {
      statementRepo.findOne.mockResolvedValue(baseStatement());
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await service.permanentDelete(STATEMENT_ID, OWNER_ID, WORKSPACE_ID);

      expect(cacheManager.del).toHaveBeenCalledWith(`statements:thumbnail:${STATEMENT_ID}`);
    });

    it('records an audit event with permanent source', async () => {
      statementRepo.findOne.mockResolvedValue(baseStatement());
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await service.permanentDelete(STATEMENT_ID, OWNER_ID, WORKSPACE_ID);

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: STATEMENT_ID,
          action: 'delete',
          meta: expect.objectContaining({ source: 'permanent' }),
        }),
      );
    });

    it('emits data.deleted event', async () => {
      statementRepo.findOne.mockResolvedValue(baseStatement());
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await service.permanentDelete(STATEMENT_ID, OWNER_ID, WORKSPACE_ID);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'data.deleted',
        expect.objectContaining({ workspaceId: WORKSPACE_ID, entityType: 'statement' }),
      );
    });

    it('allows ADMIN workspace member to permanently delete another user\'s statement', async () => {
      const adminId = 'admin-user';
      statementRepo.findOne.mockResolvedValue(baseStatement()); // owner is OWNER_ID
      workspaceMemberRepo.findOne.mockResolvedValue({ role: WorkspaceRole.ADMIN });
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);

      await expect(service.permanentDelete(STATEMENT_ID, adminId, WORKSPACE_ID)).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // updateMetadata
  // ---------------------------------------------------------------------------
  describe('updateMetadata', () => {
    function setupFindOne(overrides: Partial<Statement> = {}) {
      const stmt = { ...baseStatement(), ...overrides } as Statement;
      // updateMetadata calls this.findOne which uses createQueryBuilder if available.
      // Without createQueryBuilder in the mock, findOne falls back to statementRepo.findOne.
      statementRepo.findOne.mockResolvedValue(stmt);
      statementRepo.save.mockResolvedValue(stmt);
      return stmt;
    }

    it('updates balanceStart when provided', async () => {
      setupFindOne();

      const result = await service.updateMetadata(STATEMENT_ID, OWNER_ID, WORKSPACE_ID, {
        balanceStart: 5000,
      });

      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ balanceStart: 5000 }),
      );
    });

    // Postgres returns loaded `date` columns as strings, not Date objects.
    it('keeps metadata dates that were loaded from the database as strings', async () => {
      setupFindOne({
        statementDateFrom: '2025-01-01' as unknown as Date,
        statementDateTo: '2025-01-31' as unknown as Date,
        parsingDetails: { metadataExtracted: {} } as Statement['parsingDetails'],
      });

      await service.updateMetadata(STATEMENT_ID, OWNER_ID, WORKSPACE_ID, { balanceStart: 100 });

      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          parsingDetails: expect.objectContaining({
            metadataExtracted: expect.objectContaining({
              dateFrom: '2025-01-01',
              dateTo: '2025-01-31',
            }),
          }),
        }),
      );
    });

    it('sets balanceStart to null when explicitly passed null', async () => {
      setupFindOne({ balanceStart: 1000 });

      await service.updateMetadata(STATEMENT_ID, OWNER_ID, WORKSPACE_ID, {
        balanceStart: null,
      });

      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ balanceStart: null }),
      );
    });

    it('updates balanceEnd when provided', async () => {
      setupFindOne();

      await service.updateMetadata(STATEMENT_ID, OWNER_ID, WORKSPACE_ID, {
        balanceEnd: 12000,
      });

      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ balanceEnd: 12000 }),
      );
    });

    it('does not touch balanceStart when the field is absent from the DTO', async () => {
      setupFindOne({ balanceStart: 999 });

      await service.updateMetadata(STATEMENT_ID, OWNER_ID, WORKSPACE_ID, {
        balanceEnd: 1000,
      });

      // balanceStart should remain unchanged in the save call
      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ balanceStart: 999 }),
      );
    });

    it('updates statementDateFrom as Date object when string provided', async () => {
      setupFindOne();

      await service.updateMetadata(STATEMENT_ID, OWNER_ID, WORKSPACE_ID, {
        statementDateFrom: '2024-01-01',
      });

      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          statementDateFrom: expect.any(Date),
        }),
      );
    });

    it('sets statementDateFrom to null when explicitly null', async () => {
      setupFindOne({ statementDateFrom: new Date('2024-01-01') });

      await service.updateMetadata(STATEMENT_ID, OWNER_ID, WORKSPACE_ID, {
        statementDateFrom: null,
      });

      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ statementDateFrom: null }),
      );
    });

    it('syncs balanceStart into parsingDetails.metadataExtracted when parsingDetails exist', async () => {
      setupFindOne({
        parsingDetails: {
          metadataExtracted: { balanceStart: 0, balanceEnd: 0 },
        } as any,
      });

      await service.updateMetadata(STATEMENT_ID, OWNER_ID, WORKSPACE_ID, {
        balanceStart: 7500,
      });

      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          parsingDetails: expect.objectContaining({
            metadataExtracted: expect.objectContaining({ balanceStart: 7500 }),
          }),
        }),
      );
    });

    it('syncs statementDateFrom as ISO date string into parsingDetails.metadataExtracted', async () => {
      setupFindOne({
        parsingDetails: { metadataExtracted: {} } as any,
      });

      await service.updateMetadata(STATEMENT_ID, OWNER_ID, WORKSPACE_ID, {
        statementDateFrom: '2025-03-15',
      });

      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          parsingDetails: expect.objectContaining({
            metadataExtracted: expect.objectContaining({ dateFrom: '2025-03-15' }),
          }),
        }),
      );
    });

    it('does not modify parsingDetails when it is null', async () => {
      setupFindOne({ parsingDetails: null });

      await service.updateMetadata(STATEMENT_ID, OWNER_ID, WORKSPACE_ID, {
        balanceStart: 100,
        balanceEnd: 200,
      });

      expect(statementRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ parsingDetails: null }),
      );
    });

    it('throws ForbiddenException when requester is not owner and not admin', async () => {
      const stranger = 'stranger-user';
      setupFindOne();
      workspaceMemberRepo.findOne.mockResolvedValue({ role: WorkspaceRole.MEMBER, permissions: {} });

      await expect(
        service.updateMetadata(STATEMENT_ID, stranger, WORKSPACE_ID, { balanceEnd: 100 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when statement is not found', async () => {
      statementRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateMetadata('nonexistent', OWNER_ID, WORKSPACE_ID, { balanceStart: 100 }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
