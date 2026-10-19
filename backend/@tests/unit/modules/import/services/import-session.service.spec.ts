import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import {
  ImportSession,
  ImportSessionMode,
  ImportSessionStatus,
} from '../../../../../src/entities/import-session.entity';
import { Statement } from '../../../../../src/entities/statement.entity';
import { Transaction } from '../../../../../src/entities/transaction.entity';
import { User } from '../../../../../src/entities/user.entity';
import { Workspace } from '../../../../../src/entities/workspace.entity';
import {
  ImportConflictError,
  ImportValidationError,
} from '../../../../../src/modules/import/errors/import-errors';
import { ImportSessionService } from '../../../../../src/modules/import/services/import-session.service';
import { ParsedTransaction } from '../../../../../src/modules/parsing/interfaces/parsed-statement.interface';
import {
  ConflictAction,
  IntelligentDeduplicationService,
} from '../../../../../src/modules/parsing/services/intelligent-deduplication.service';
import { TransactionFingerprintService } from '../../../../../src/modules/transactions/services/transaction-fingerprint.service';
import { ImportConfigService } from '../../../../../src/modules/import/config/import.config';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ImportSessionService', () => {
  let service: ImportSessionService;
  let importSessionRepository: jest.Mocked<Repository<ImportSession>>;
  let transactionRepository: jest.Mocked<Repository<Transaction>>;
  let statementRepository: jest.Mocked<Repository<Statement>>;
  let workspaceRepository: jest.Mocked<Repository<Workspace>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let dataSource: jest.Mocked<DataSource>;
  let fingerprintService: jest.Mocked<TransactionFingerprintService>;
  let deduplicationService: jest.Mocked<IntelligentDeduplicationService>;
  let queryRunner: jest.Mocked<QueryRunner>;

  const mockWorkspace: Workspace = {
    id: 'workspace-1',
    name: 'Test Workspace',
  } as Workspace;

  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
  } as User;

  const mockStatement: Statement = {
    id: 'statement-1',
    workspaceId: 'workspace-1',
    accountNumber: '1234567890',
  } as Statement;

  const mockParsedTransaction: ParsedTransaction = {
    transactionDate: new Date('2024-01-15'),
    documentNumber: 'DOC123',
    counterpartyName: 'Test Merchant',
    counterpartyBin: '123456789012',
    counterpartyAccount: '9876543210',
    counterpartyBank: 'Test Bank',
    debit: 0,
    credit: 1000,
    paymentPurpose: 'Test payment',
    currency: 'KZT',
  };

  beforeEach(async () => {
    // Create separate mock repositories for each entity. `update` defaults
    // to a realistic UpdateResult (affected: 1) since processImport's
    // commit-mode transition now branches on `.affected` — individual tests
    // override this when they need to simulate a no-op update (e.g. a lost
    // conditional-update race).
    const createMockRepository = () => ({
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    });

    // Create mock query runner
    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportSessionService,
        {
          provide: getRepositoryToken(ImportSession),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Statement),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(Workspace),
          useValue: createMockRepository(),
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(queryRunner),
          },
        },
        {
          provide: TransactionFingerprintService,
          useValue: {
            generateFingerprint: jest.fn(),
            findByFingerprints: jest.fn(),
            findCandidatesByWindow: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: IntelligentDeduplicationService,
          useValue: {
            detectConflicts: jest.fn(),
          },
        },
        {
          provide: ImportConfigService,
          useValue: {
            getDedupDateToleranceDays: jest.fn().mockReturnValue(2),
            getDedupAmountTolerancePercent: jest.fn().mockReturnValue(5),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ImportSessionService>(ImportSessionService);
    importSessionRepository = module.get(getRepositoryToken(ImportSession));
    transactionRepository = module.get(getRepositoryToken(Transaction));
    statementRepository = module.get(getRepositoryToken(Statement));
    workspaceRepository = module.get(getRepositoryToken(Workspace));
    userRepository = module.get(getRepositoryToken(User));
    dataSource = module.get(DataSource);
    fingerprintService = module.get(TransactionFingerprintService);
    deduplicationService = module.get(IntelligentDeduplicationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new import session successfully', async () => {
      // Setup mocks for the first call (checking existing session)
      importSessionRepository.findOne.mockResolvedValueOnce(null);

      // Setup mocks for validation checks
      workspaceRepository.findOne.mockResolvedValue(mockWorkspace);
      userRepository.findOne.mockResolvedValue(mockUser);
      statementRepository.findOne.mockResolvedValue(mockStatement);

      const mockSession: ImportSession = {
        id: 'session-1',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        statementId: 'statement-1',
        mode: ImportSessionMode.PREVIEW,
        fileHash: 'abc123',
        fileName: 'test.pdf',
        fileSize: 1024,
        status: ImportSessionStatus.PENDING,
        sessionMetadata: null,
      } as ImportSession;

      importSessionRepository.create.mockReturnValue(mockSession);
      importSessionRepository.save.mockResolvedValue(mockSession);

      const result = await service.createSession(
        'workspace-1',
        'user-1',
        'statement-1',
        ImportSessionMode.PREVIEW,
        'abc123',
        'test.pdf',
        1024,
      );

      expect(result).toEqual(mockSession);
      expect(workspaceRepository.findOne).toHaveBeenCalledWith({ where: { id: 'workspace-1' } });
      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
      expect(statementRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'statement-1', workspaceId: 'workspace-1' },
      });
      expect(importSessionRepository.save).toHaveBeenCalled();
    });

    it('should return existing session if file hash already imported', async () => {
      workspaceRepository.findOne.mockResolvedValue(mockWorkspace);
      userRepository.findOne.mockResolvedValue(mockUser);

      const existingSession: ImportSession = {
        id: 'existing-session-1',
        workspaceId: 'workspace-1',
        fileHash: 'abc123',
        status: ImportSessionStatus.COMPLETED,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(existingSession);

      const result = await service.createSession(
        'workspace-1',
        'user-1',
        null,
        ImportSessionMode.PREVIEW,
        'abc123',
        'test.pdf',
        1024,
      );

      expect(result).toEqual(existingSession);
      expect(importSessionRepository.create).not.toHaveBeenCalled();
    });

    it('should create a fresh session for the same file hash when the existing one failed', async () => {
      workspaceRepository.findOne.mockResolvedValue(mockWorkspace);
      userRepository.findOne.mockResolvedValue(mockUser);

      const failedSession: ImportSession = {
        id: 'failed-session-1',
        workspaceId: 'workspace-1',
        fileHash: 'abc123',
        status: ImportSessionStatus.FAILED,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(failedSession);

      const newSession: ImportSession = {
        id: 'retry-session-1',
        workspaceId: 'workspace-1',
        fileHash: 'abc123',
        status: ImportSessionStatus.PENDING,
      } as ImportSession;
      importSessionRepository.create.mockReturnValue(newSession);
      importSessionRepository.save.mockResolvedValue(newSession);

      const result = await service.createSession(
        'workspace-1',
        'user-1',
        null,
        ImportSessionMode.PREVIEW,
        'abc123',
        'test.pdf',
        1024,
      );

      expect(importSessionRepository.create).toHaveBeenCalled();
      expect(result).toEqual(newSession);
    });

    it('should create session with default fileSize when not provided', async () => {
      importSessionRepository.findOne.mockResolvedValueOnce(null);
      workspaceRepository.findOne.mockResolvedValue(mockWorkspace);
      userRepository.findOne.mockResolvedValue(mockUser);

      const mockSession: ImportSession = {
        id: 'session-2',
        workspaceId: 'workspace-1',
        userId: 'user-1',
        fileHash: 'xyz789',
        fileName: 'test.pdf',
        fileSize: 0, // Default value
        status: ImportSessionStatus.PENDING,
      } as ImportSession;

      importSessionRepository.create.mockReturnValue(mockSession);
      importSessionRepository.save.mockResolvedValue(mockSession);

      const result = await service.createSession(
        'workspace-1',
        'user-1',
        null,
        ImportSessionMode.PREVIEW,
        'xyz789',
        'test.pdf',
        // fileSize not provided
      );

      expect(result).toEqual(mockSession);
      expect(importSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileSize: 0, // Should default to 0
        }),
      );
    });

    it('should throw ImportValidationError if workspace not found', async () => {
      workspaceRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createSession(
          'invalid-workspace',
          'user-1',
          null,
          ImportSessionMode.PREVIEW,
          'abc123',
          'test.pdf',
          1024,
        ),
      ).rejects.toThrow(ImportValidationError);
    });

    it('should throw ImportValidationError if user not found', async () => {
      workspaceRepository.findOne.mockResolvedValue(mockWorkspace);
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createSession(
          'workspace-1',
          'invalid-user',
          null,
          ImportSessionMode.PREVIEW,
          'abc123',
          'test.pdf',
          1024,
        ),
      ).rejects.toThrow(ImportValidationError);
    });

    it('should throw ImportValidationError if statement not found', async () => {
      workspaceRepository.findOne.mockResolvedValue(mockWorkspace);
      userRepository.findOne.mockResolvedValue(mockUser);
      statementRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createSession(
          'workspace-1',
          'user-1',
          'invalid-statement',
          ImportSessionMode.PREVIEW,
          'abc123',
          'test.pdf',
          1024,
        ),
      ).rejects.toThrow(ImportValidationError);
    });
  });

  describe('processImport - Preview Mode', () => {
    const mockSession: ImportSession = {
      id: 'session-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      statementId: 'statement-1',
      mode: ImportSessionMode.PREVIEW,
      status: ImportSessionStatus.PENDING,
      statement: mockStatement,
      sessionMetadata: null,
    } as ImportSession;

    it('should process preview successfully with new transactions', async () => {
      importSessionRepository.findOne.mockResolvedValue(mockSession);
      fingerprintService.generateFingerprint.mockReturnValue('fingerprint-1');
      fingerprintService.findByFingerprints.mockResolvedValue([]);
      fingerprintService.findCandidatesByWindow.mockResolvedValue([]);
      deduplicationService.detectConflicts.mockResolvedValue([]);
      importSessionRepository.update.mockResolvedValue(undefined as any);

      const transactions = [mockParsedTransaction];
      const result = await service.processImport(
        'session-1',
        transactions,
        ImportSessionMode.PREVIEW,
      );

      expect(result.status).toBe(ImportSessionStatus.PREVIEW);
      expect(result.summary.totalTransactions).toBe(1);
      expect(result.summary.newCount).toBe(1);
      expect(result.summary.matchedCount).toBe(0);
      expect(result.summary.conflictedCount).toBe(0);
      expect(fingerprintService.generateFingerprint).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockParsedTransaction,
          workspaceId: 'workspace-1',
          amount: 1000,
        }),
        '1234567890',
      );
    });

    it('should detect exact matches by fingerprint', async () => {
      const existingTransaction: Transaction = {
        id: 'existing-1',
        fingerprint: 'fingerprint-1',
        workspaceId: 'workspace-1',
      } as Transaction;

      importSessionRepository.findOne.mockResolvedValue(mockSession);
      fingerprintService.generateFingerprint.mockReturnValue('fingerprint-1');
      fingerprintService.findByFingerprints.mockResolvedValue([existingTransaction]);
      fingerprintService.findCandidatesByWindow.mockResolvedValue([]);
      deduplicationService.detectConflicts.mockResolvedValue([]);
      importSessionRepository.update.mockResolvedValue(undefined as any);

      const transactions = [mockParsedTransaction];
      const result = await service.processImport(
        'session-1',
        transactions,
        ImportSessionMode.PREVIEW,
      );

      expect(result.status).toBe(ImportSessionStatus.PREVIEW);
      expect(result.summary.totalTransactions).toBe(1);
      expect(result.summary.newCount).toBe(0);
      expect(result.summary.matchedCount).toBe(1);
      expect(result.summary.conflictedCount).toBe(0);
    });

    it('flags the second of two same-batch rows that hash to the same fingerprint, rather than leaving both "new" (regression)', async () => {
      // Two distinct rows (e.g. two separate same-day, same-amount purchases
      // at the same merchant) can legitimately collide on fingerprint. Left
      // unflagged, processCommit would insert both as plain 'new' rows and
      // the second INSERT would violate the partial unique index
      // (workspace_id, fingerprint) WHERE is_duplicate=false, rolling back
      // the entire commit.
      importSessionRepository.findOne.mockResolvedValue(mockSession);
      fingerprintService.generateFingerprint.mockReturnValue('fingerprint-collision');
      fingerprintService.findByFingerprints.mockResolvedValue([]);
      fingerprintService.findCandidatesByWindow.mockResolvedValue([]);
      deduplicationService.detectConflicts.mockResolvedValue([]);
      importSessionRepository.update.mockResolvedValue(undefined as any);

      const transactions = [mockParsedTransaction, { ...mockParsedTransaction }];
      const result = await service.processImport(
        'session-1',
        transactions,
        ImportSessionMode.PREVIEW,
      );

      // Both are still real, distinct "new" transactions — nothing is
      // silently dropped from the count.
      expect(result.summary.newCount).toBe(2);

      const updateCall = importSessionRepository.update.mock.calls.find(
        ([, entity]: any) => entity?.sessionMetadata?.previewData,
      );
      const classifications = updateCall?.[1].sessionMetadata.previewData.classifications;
      expect(classifications[0].duplicateInBatch).toBeFalsy();
      expect(classifications[1].duplicateInBatch).toBe(true);
    });

    it('should detect conflicts using tolerant matching', async () => {
      const existingTransaction: Transaction = {
        id: 'existing-1',
        fingerprint: 'different-fingerprint',
        workspaceId: 'workspace-1',
      } as Transaction;

      const conflict = {
        newTransaction: mockParsedTransaction,
        existingTransaction,
        confidence: 0.85,
        matchType: 'fuzzy_date' as const,
        recommendedAction: ConflictAction.MANUAL_REVIEW,
        details: { dateDiff: 1 },
      };

      importSessionRepository.findOne.mockResolvedValue(mockSession);
      fingerprintService.generateFingerprint.mockReturnValue('fingerprint-1');
      fingerprintService.findByFingerprints.mockResolvedValue([existingTransaction]);
      fingerprintService.findCandidatesByWindow.mockResolvedValue([existingTransaction]);
      deduplicationService.detectConflicts.mockResolvedValue([conflict]);
      importSessionRepository.update.mockResolvedValue(undefined as any);

      const transactions = [mockParsedTransaction];
      const result = await service.processImport(
        'session-1',
        transactions,
        ImportSessionMode.PREVIEW,
      );

      expect(result.status).toBe(ImportSessionStatus.PREVIEW);
      expect(result.summary.totalTransactions).toBe(1);
      expect(result.summary.newCount).toBe(0);
      expect(result.summary.matchedCount).toBe(0);
      expect(result.summary.conflictedCount).toBe(1);
      expect(result.summary.conflicts).toHaveLength(1);
      expect(result.summary.conflicts[0].confidence).toBe(0.85);
    });

    it('should handle fingerprint generation errors gracefully', async () => {
      importSessionRepository.findOne.mockResolvedValue(mockSession);
      fingerprintService.generateFingerprint.mockImplementation(() => {
        throw new Error('Fingerprint generation failed');
      });
      fingerprintService.findByFingerprints.mockResolvedValue([]);
      fingerprintService.findCandidatesByWindow.mockResolvedValue([]);
      deduplicationService.detectConflicts.mockResolvedValue([]);
      importSessionRepository.update.mockResolvedValue(undefined as any);

      const transactions = [mockParsedTransaction];
      const result = await service.processImport(
        'session-1',
        transactions,
        ImportSessionMode.PREVIEW,
      );

      expect(result.summary.totalTransactions).toBe(1);
      expect(result.summary.failedCount).toBe(1);
      expect(result.summary.errors).toHaveLength(1);
    });

    it('should throw ImportValidationError if session not found', async () => {
      importSessionRepository.findOne.mockResolvedValue(null);

      await expect(
        service.processImport('invalid-session', [], ImportSessionMode.PREVIEW),
      ).rejects.toThrow(ImportValidationError);
    });
  });

  describe('processImport - Commit Mode', () => {
    const mockSession: ImportSession = {
      id: 'session-1',
      workspaceId: 'workspace-1',
      userId: 'user-1',
      statementId: 'statement-1',
      mode: ImportSessionMode.COMMIT,
      status: ImportSessionStatus.PREVIEW,
      statement: mockStatement,
      sessionMetadata: {
        totalTransactions: 1,
        newCount: 1,
        matchedCount: 0,
        skippedCount: 0,
        conflictedCount: 0,
        failedCount: 0,
        conflicts: [],
        warnings: [],
        errors: [],
        previewData: {
          classifications: [
            {
              index: 0,
              status: 'new',
              fingerprint: 'fingerprint-1',
            },
          ],
        },
      } as any,
    } as ImportSession;

    it('should commit new transactions successfully', async () => {
      importSessionRepository.findOne.mockResolvedValue(mockSession);
      fingerprintService.generateFingerprint.mockReturnValue('fingerprint-1');

      const mockTransaction = {
        id: 'tx-1',
        fingerprint: 'fingerprint-1',
      } as Transaction;

      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);
      importSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      const transactions = [mockParsedTransaction];
      const result = await service.processImport(
        'session-1',
        transactions,
        ImportSessionMode.COMMIT,
      );

      expect(result.status).toBe(ImportSessionStatus.COMPLETED);
      expect(result.summary.newCount).toBe(1);
      expect(queryRunner.commitTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('persists a within-batch fingerprint collision as isDuplicate=true instead of a plain insert (regression)', async () => {
      const sessionWithBatchDuplicate: ImportSession = {
        ...mockSession,
        sessionMetadata: {
          ...mockSession.sessionMetadata,
          previewData: {
            classifications: [
              { index: 0, status: 'new', fingerprint: 'fingerprint-1' },
              { index: 1, status: 'new', fingerprint: 'fingerprint-1', duplicateInBatch: true },
            ],
          },
        } as any,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(sessionWithBatchDuplicate);
      fingerprintService.generateFingerprint.mockReturnValue('fingerprint-1');

      const mockTransaction = { id: 'tx-2', fingerprint: 'fingerprint-1', isDuplicate: false };
      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);
      importSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      const transactions = [mockParsedTransaction, { ...mockParsedTransaction }];
      await service.processImport('session-1', transactions, ImportSessionMode.COMMIT);

      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ isDuplicate: true }),
      );
    });

    it('should skip matched transactions', async () => {
      const sessionWithMatches: ImportSession = {
        ...mockSession,
        sessionMetadata: {
          ...mockSession.sessionMetadata,
          previewData: {
            classifications: [
              {
                index: 0,
                status: 'matched',
                fingerprint: 'fingerprint-1',
              },
            ],
          },
        } as any,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(sessionWithMatches);
      importSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      const transactions = [mockParsedTransaction];
      const result = await service.processImport(
        'session-1',
        transactions,
        ImportSessionMode.COMMIT,
      );

      expect(result.status).toBe(ImportSessionStatus.COMPLETED);
      expect(result.summary.matchedCount).toBe(1);
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('should throw ImportConflictError if unresolved conflicts exist', async () => {
      const sessionWithConflicts: ImportSession = {
        ...mockSession,
        sessionMetadata: {
          ...mockSession.sessionMetadata,
          previewData: {
            classifications: [
              {
                index: 0,
                status: 'conflicted',
                fingerprint: 'fingerprint-1',
                // No resolution provided
              },
            ],
          },
        } as any,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(sessionWithConflicts);

      await expect(
        service.processImport('session-1', [mockParsedTransaction], ImportSessionMode.COMMIT),
      ).rejects.toThrow(ImportConflictError);
    });

    it('should apply conflict resolution: skip', async () => {
      const sessionWithResolution: ImportSession = {
        ...mockSession,
        sessionMetadata: {
          ...mockSession.sessionMetadata,
          previewData: {
            classifications: [
              {
                index: 0,
                status: 'conflicted',
                fingerprint: 'fingerprint-1',
                resolution: 'skip',
              },
            ],
          },
        } as any,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(sessionWithResolution);
      importSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      const transactions = [mockParsedTransaction];
      const result = await service.processImport(
        'session-1',
        transactions,
        ImportSessionMode.COMMIT,
      );

      expect(result.status).toBe(ImportSessionStatus.COMPLETED);
      expect(result.summary.skippedCount).toBe(1);
      expect(queryRunner.manager.save).not.toHaveBeenCalled();
    });

    it('should apply conflict resolution: mark_duplicate', async () => {
      const sessionWithResolution: ImportSession = {
        ...mockSession,
        sessionMetadata: {
          ...mockSession.sessionMetadata,
          previewData: {
            classifications: [
              {
                index: 0,
                status: 'conflicted',
                fingerprint: 'fingerprint-1',
                resolution: 'mark_duplicate',
                existingTransactionId: 'existing-1',
                conflictConfidence: 0.85,
                conflictMatchType: 'fuzzy_date',
              },
            ],
          },
        } as any,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(sessionWithResolution);
      fingerprintService.generateFingerprint.mockReturnValue('fingerprint-1');

      const mockTransaction = {
        id: 'tx-1',
        fingerprint: 'fingerprint-1',
        isDuplicate: true,
        duplicateOfId: 'existing-1',
        duplicateConfidence: 0.85,
        duplicateMatchType: 'fuzzy_date',
      } as Transaction;

      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);
      importSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      const transactions = [mockParsedTransaction];
      const result = await service.processImport(
        'session-1',
        transactions,
        ImportSessionMode.COMMIT,
      );

      expect(result.status).toBe(ImportSessionStatus.COMPLETED);
      expect(result.summary.matchedCount).toBe(1);
      expect(queryRunner.manager.save).toHaveBeenCalled();
    });

    it('should apply conflict resolution: force_import', async () => {
      const sessionWithResolution: ImportSession = {
        ...mockSession,
        sessionMetadata: {
          ...mockSession.sessionMetadata,
          previewData: {
            classifications: [
              {
                index: 0,
                status: 'conflicted',
                fingerprint: 'fingerprint-1',
                resolution: 'force_import',
              },
            ],
          },
        } as any,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(sessionWithResolution);
      fingerprintService.generateFingerprint.mockReturnValue('fingerprint-1');

      const mockTransaction = {
        id: 'tx-1',
        fingerprint: 'fingerprint-1',
        isDuplicate: false,
      } as Transaction;

      queryRunner.manager.create.mockReturnValue(mockTransaction);
      queryRunner.manager.save.mockResolvedValue(mockTransaction);
      importSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      const transactions = [mockParsedTransaction];
      const result = await service.processImport(
        'session-1',
        transactions,
        ImportSessionMode.COMMIT,
      );

      expect(result.status).toBe(ImportSessionStatus.COMPLETED);
      expect(result.summary.newCount).toBe(1);
      expect(queryRunner.manager.save).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      importSessionRepository.findOne.mockResolvedValue(mockSession);
      fingerprintService.generateFingerprint.mockReturnValue('fingerprint-1');
      queryRunner.manager.create.mockImplementation(() => {
        throw new Error('Database error');
      });

      const transactions = [mockParsedTransaction];

      await expect(
        service.processImport('session-1', transactions, ImportSessionMode.COMMIT),
      ).rejects.toThrow();

      expect(queryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(queryRunner.release).toHaveBeenCalled();
    });

    it('should throw ImportValidationError if no preview data exists', async () => {
      const sessionWithoutPreview: ImportSession = {
        ...mockSession,
        sessionMetadata: null,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(sessionWithoutPreview);

      await expect(
        service.processImport('session-1', [mockParsedTransaction], ImportSessionMode.COMMIT),
      ).rejects.toThrow(ImportValidationError);
    });

    it('should throw ImportConflictError if session not in PREVIEW status', async () => {
      const sessionInWrongStatus: ImportSession = {
        ...mockSession,
        status: ImportSessionStatus.PENDING,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(sessionInWrongStatus);
      // The COMMIT-mode transition is `UPDATE ... WHERE status = PREVIEW`, a
      // real DB WHERE clause a session already in PENDING would never match
      // — simulate that here rather than the default affected:1.
      importSessionRepository.update.mockResolvedValueOnce({ affected: 0 } as any);

      await expect(
        service.processImport('session-1', [mockParsedTransaction], ImportSessionMode.COMMIT),
      ).rejects.toThrow(ImportConflictError);

      // A losing/rejected transition made no changes to the session — must
      // not overwrite its status (there's nothing to overwrite it FROM in
      // this test, but in the concurrent-commit case this is what stops the
      // loser from clobbering the winner's COMPLETED status back to FAILED).
      expect(importSessionRepository.update).toHaveBeenCalledTimes(1);
    });

    it('does not let a losing concurrent commit overwrite the winning commit\'s COMPLETED status', async () => {
      // Simulates the actual race: another request already won the
      // conditional transition (status is no longer PREVIEW by the time
      // this request's own UPDATE runs), and has since completed.
      importSessionRepository.findOne.mockResolvedValue(mockSession);
      importSessionRepository.update.mockResolvedValueOnce({ affected: 0 } as any);

      await expect(
        service.processImport('session-1', [mockParsedTransaction], ImportSessionMode.COMMIT),
      ).rejects.toThrow(ImportConflictError);

      // Only the one failed conditional-update call — no FAILED-status
      // write, since this request never took ownership of the session.
      expect(importSessionRepository.update).toHaveBeenCalledTimes(1);
      expect(importSessionRepository.update).not.toHaveBeenCalledWith(
        { id: 'session-1' },
        expect.objectContaining({ status: ImportSessionStatus.FAILED }),
      );
    });
  });

  describe('getSessionSummary', () => {
    it('should return session summary', async () => {
      const mockSession: ImportSession = {
        id: 'session-1',
        sessionMetadata: {
          totalTransactions: 10,
          newCount: 5,
          matchedCount: 3,
          skippedCount: 1,
          conflictedCount: 1,
          failedCount: 0,
          conflicts: [{ transactionIndex: 5, reason: 'Test conflict', confidence: 0.8 }],
          warnings: ['Warning 1'],
          errors: [],
        },
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(mockSession);

      const result = await service.getSessionSummary('session-1');

      expect(result.totalTransactions).toBe(10);
      expect(result.newCount).toBe(5);
      expect(result.matchedCount).toBe(3);
      expect(result.conflictedCount).toBe(1);
      expect(result.conflicts).toHaveLength(1);
    });

    it('should return empty metadata if session has no metadata', async () => {
      const mockSession: ImportSession = {
        id: 'session-1',
        sessionMetadata: null,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(mockSession);

      const result = await service.getSessionSummary('session-1');

      expect(result.totalTransactions).toBe(0);
      expect(result.newCount).toBe(0);
      expect(result.matchedCount).toBe(0);
    });

    it('should throw ImportValidationError if session not found', async () => {
      importSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.getSessionSummary('invalid-session')).rejects.toThrow(
        ImportValidationError,
      );
    });
  });

  describe('resolveConflicts', () => {
    const mockSession: ImportSession = {
      id: 'session-1',
      status: ImportSessionStatus.PREVIEW,
      sessionMetadata: {
        totalTransactions: 2,
        newCount: 0,
        matchedCount: 0,
        skippedCount: 0,
        conflictedCount: 2,
        failedCount: 0,
        conflicts: [],
        warnings: [],
        errors: [],
        previewData: {
          classifications: [
            {
              index: 0,
              status: 'conflicted',
              fingerprint: 'fingerprint-1',
            },
            {
              index: 1,
              status: 'conflicted',
              fingerprint: 'fingerprint-2',
            },
          ],
        },
      } as any,
    } as ImportSession;

    it('should resolve conflicts successfully', async () => {
      importSessionRepository.findOne.mockResolvedValue(mockSession);
      importSessionRepository.update.mockResolvedValue(undefined as any);

      const resolutions = {
        0: 'skip' as const,
        1: 'force_import' as const,
      };

      await service.resolveConflicts('session-1', resolutions);

      expect(importSessionRepository.update).toHaveBeenCalledWith(
        { id: 'session-1' },
        expect.objectContaining({
          sessionMetadata: expect.objectContaining({
            previewData: expect.objectContaining({
              classifications: expect.arrayContaining([
                expect.objectContaining({
                  index: 0,
                  status: 'conflicted',
                  resolution: 'skip',
                }),
                expect.objectContaining({
                  index: 1,
                  status: 'conflicted',
                  resolution: 'force_import',
                }),
              ]),
            }),
          }),
        }),
      );
    });

    it('should throw ImportValidationError if session not in PREVIEW status', async () => {
      const sessionInWrongStatus: ImportSession = {
        ...mockSession,
        status: ImportSessionStatus.COMPLETED,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(sessionInWrongStatus);

      await expect(service.resolveConflicts('session-1', { 0: 'skip' })).rejects.toThrow(
        ImportValidationError,
      );
    });

    it('should throw ImportValidationError if no preview data exists', async () => {
      const sessionWithoutPreview: ImportSession = {
        ...mockSession,
        sessionMetadata: null,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(sessionWithoutPreview);

      await expect(service.resolveConflicts('session-1', { 0: 'skip' })).rejects.toThrow(
        ImportValidationError,
      );
    });
  });

  describe('cancelSession', () => {
    it('should cancel session successfully', async () => {
      const mockSession: ImportSession = {
        id: 'session-1',
        status: ImportSessionStatus.PREVIEW,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(mockSession);
      importSessionRepository.update.mockResolvedValue(undefined as any);

      await service.cancelSession('session-1');

      expect(importSessionRepository.update).toHaveBeenCalledWith(
        { id: 'session-1' },
        expect.objectContaining({
          status: ImportSessionStatus.CANCELLED,
          completedAt: expect.any(Date),
        }),
      );
    });

    it('should throw ImportValidationError if session already completed', async () => {
      const completedSession: ImportSession = {
        id: 'session-1',
        status: ImportSessionStatus.COMPLETED,
      } as ImportSession;

      importSessionRepository.findOne.mockResolvedValue(completedSession);

      await expect(service.cancelSession('session-1')).rejects.toThrow(ImportValidationError);
    });

    it('should throw ImportValidationError if session not found', async () => {
      importSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.cancelSession('invalid-session')).rejects.toThrow(ImportValidationError);
    });
  });
});
