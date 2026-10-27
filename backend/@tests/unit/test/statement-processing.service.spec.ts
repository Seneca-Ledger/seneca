import type { Mock } from 'vitest';
vi.mock('franc', () => ({
  franc: () => 'und',
}));

import { ConflictException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BankName, FileType, type Statement, StatementStatus } from '@/entities/statement.entity';
import type { Transaction } from '@/entities/transaction.entity';
import type { ParsedStatement } from '@/modules/parsing/interfaces/parsed-statement.interface';
import {
  StatementProcessingService,
  StatementRejected,
} from '@/modules/parsing/services/statement-processing.service';

describe('StatementProcessingService', () => {
  const tempFilePath = path.join(os.tmpdir(), 'sample.pdf');
  const statement: Statement = {
    id: 'stmt-1',
    userId: 'user-1',
    user: null as any,
    workspaceId: 'ws-1',
    fileName: 'sample.pdf',
    filePath: tempFilePath,
    fileType: FileType.PDF,
    fileSize: 1024,
    fileHash: 'hash',
    bankName: BankName.OTHER,
    accountNumber: null,
    statementDateFrom: null,
    statementDateTo: null,
    balanceStart: null,
    balanceEnd: null,
    status: StatementStatus.UPLOADED,
    errorMessage: null,
    totalTransactions: 0,
    totalDebit: 0,
    totalCredit: 0,
    currency: 'KZT',
    transactions: [] as Transaction[],
    createdAt: new Date(),
    updatedAt: new Date(),
    processedAt: null,
    parsingDetails: null,
  } as unknown as Statement;

  const savedTransactions: Transaction[] = [];

  const statementRepository = {
    findOne: vi.fn(async ({ where: { id } }) => (id === statement.id ? statement : null)),
    save: vi.fn(async (entity: Partial<Statement>) => {
      Object.assign(statement, entity);
      return statement;
    }),
    // Mid-pipeline heartbeats use update(), not save() — same merge
    // semantics here so assertions against the final `statement` object
    // still see whatever the heartbeat wrote.
    update: vi.fn(async (_id: string, entity: Partial<Statement>) => {
      Object.assign(statement, entity);
      return { affected: 1 };
    }),
  };

  const transactionRepository = {
    create: vi.fn((data: Partial<Transaction>) => data as Transaction),
    save: vi.fn(async (data: Partial<Transaction>) => {
      const saved = { id: `tx-${savedTransactions.length + 1}`, ...data } as Transaction;
      savedTransactions.push(saved);
      return saved;
    }),
    count: vi.fn(async () => 0),
  };

  const classificationService = {
    classifyTransaction: vi.fn(async () => ({ categoryId: 'cat-1' })),
  };

  const metadataExtractionService = {
    extractMetadata: vi.fn(async () => null),
    createDisplayInfo: vi.fn(() => ({
      title: 'Statement',
      subtitle: '',
      periodDisplay: '',
      accountDisplay: '',
      institutionDisplay: '',
      currencyDisplay: '',
    })),
    convertToParsedStatementMetadata: vi.fn(() => ({})),
  };

  const importSessionService = {
    createSession: vi.fn(async () => ({ id: 'session-1' })),
    processImport: vi.fn(async () => ({ summary: {} })),
    getSession: vi.fn(async () => ({ id: 'session-1', sessionMetadata: {} })),
  };

  const transactionFingerprintService = {
    bulkGenerateFingerprints: vi.fn(() => new Map()),
    generateFingerprint: vi.fn(
      (tx: Partial<Transaction>) => `fp-${tx.documentNumber ?? 'none'}`,
    ),
    findByFingerprints: vi.fn(async () => [] as Transaction[]),
  };

  // Runs the callback against a manager whose save() feeds the same
  // savedTransactions array the repository mock uses.
  const walletRepository = {
    find: vi.fn(async () => [] as unknown[]),
    findOne: vi.fn(async () => null as unknown),
  };

  const dataSource = {
    getRepository: vi.fn(() => walletRepository),
    transaction: vi.fn(async (run: (manager: unknown) => Promise<unknown>) =>
      run({
        save: vi.fn(async (_entity: unknown, rows: Partial<Transaction>[]) =>
          rows.map(row => {
            const saved = { id: `tx-${savedTransactions.length + 1}`, ...row } as Transaction;
            savedTransactions.push(saved);
            return saved;
          }),
        ),
      }),
    ),
  };

  const parsedStatement: ParsedStatement = {
    metadata: {
      accountNumber: '',
      dateFrom: null as unknown as Date,
      dateTo: null as unknown as Date,
      balanceStart: undefined,
      balanceEnd: undefined,
      currency: '',
    },
    transactions: [
      {
        transactionDate: new Date('2024-01-05'),
        documentNumber: 'DOC-1',
        counterpartyName: 'Supplier LLC',
        counterpartyBin: '123456789012',
        counterpartyAccount: 'KZACC123',
        counterpartyBank: 'Bereke',
        debit: 100,
        credit: undefined,
        paymentPurpose: 'Invoice payment',
        currency: 'USD',
        exchangeRate: 1,
        amountForeign: 100,
      },
      {
        transactionDate: new Date('2024-01-10'),
        documentNumber: 'DOC-2',
        counterpartyName: 'Customer LLC',
        counterpartyBin: '987654321000',
        counterpartyAccount: 'KZACC456',
        counterpartyBank: 'Bereke',
        debit: undefined,
        credit: 200,
        paymentPurpose: 'Sale income',
        currency: 'USD',
        exchangeRate: 1,
        amountForeign: 200,
      },
    ],
  };

  const parserFactory = {
    detectBankAndFormat: vi.fn(async () => ({
      bankName: BankName.BEREKE_NEW,
      formatVersion: 'v1',
      detectedBy: 'header-name',
      detectedEvidence: ['name:bereke'],
      otherBankMentions: ['Kaspi Bank'],
    })),
    getParser: vi.fn(async () => ({
      parse: vi.fn().mockResolvedValue(parsedStatement),
      constructor: { name: 'FakeParser' },
    })),
  };

  let service: StatementProcessingService;

  beforeEach(() => {
    vi.clearAllMocks();
    savedTransactions.length = 0;

    fs.writeFileSync(tempFilePath, Buffer.from('%PDF-1.4\n%stub\n'));

    service = new StatementProcessingService(
      statementRepository as any,
      transactionRepository as any,
      { findOne: vi.fn().mockResolvedValue({ name: 'User' }) } as any,
      parserFactory as any,
      classificationService as any,
      metadataExtractionService as any,
      importSessionService as any,
      transactionFingerprintService as any,
      dataSource as any,
      {
        resolve: vi.fn(async () => ({
          taxRateId: null,
          taxRuleId: null,
          taxSource: null,
          taxAmount: null,
          taxNetAmount: null,
          taxReverseCharge: false,
          taxNotionalAmount: null,
        })),
      } as any,
    );
  });

  afterEach(() => {
    try {
      fs.unlinkSync(tempFilePath);
    } catch {
      // ignore
    }
  });

  it('persists parsed transactions and marks statement completed', async () => {
    await service.processStatement(statement.id);

    expect(classificationService.classifyTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        counterpartyName: 'Supplier LLC',
        paymentPurpose: 'Invoice payment',
      }),
      statement.userId,
    );

    // No account number in parser metadata falls back to 'Unknown', never to
    // a transaction's counterparty account (that belongs to the other party).
    expect(statement.accountNumber).toBe('Unknown');
    expect(statement.statementDateFrom?.toISOString()).toContain('2024-01-05');
    expect(statement.statementDateTo?.toISOString()).toContain('2024-01-10');
    expect(statement.currency).toBe('USD');
    expect(statement.status).toBe(StatementStatus.COMPLETED);

    expect(statement.parsingDetails?.metadataExtracted).toMatchObject({
      accountNumber: 'Unknown',
      currency: 'USD',
    });
    expect(statement.parsingDetails?.transactionsFound).toBe(2);
    expect(statement.parsingDetails?.transactionsCreated).toBe(2);
    expect(statement.parsingDetails?.transactionsDeduplicated).toBe(0);
    expect(statement.parsingDetails?.importPreview).toBeUndefined();

    expect(savedTransactions).toHaveLength(2);
    expect(savedTransactions[0]).toMatchObject({
      documentNumber: 'DOC-1',
      counterpartyBin: '123456789012',
      counterpartyAccount: 'KZACC123',
      counterpartyBank: 'Bereke',
      paymentPurpose: 'Invoice payment',
      exchangeRate: 1,
      amountForeign: 100,
      currency: 'USD',
    });
    expect(statement.totalDebit).toBe(100);
    expect(statement.totalCredit).toBe(200);
    expect(statement.totalTransactions).toBe(2);
  });

  describe('the account of a statement', () => {
    afterEach(() => {
      statement.walletId = null;
      statement.accountNumber = null;
    });

    it('puts every row in the account the statement was uploaded to', async () => {
      statement.walletId = 'wallet-everyday';
      walletRepository.findOne.mockResolvedValueOnce({
        id: 'wallet-everyday',
        ownerMemberId: 'member-1',
      });
      // A rule pointing elsewhere does not move a row out of its statement's account.
      classificationService.classifyTransaction.mockResolvedValue({
        categoryId: 'cat-1',
        walletId: 'wallet-other',
      } as never);

      await service.processStatement(statement.id);

      expect(savedTransactions).toHaveLength(2);
      for (const row of savedTransactions) {
        expect(row).toMatchObject({ walletId: 'wallet-everyday', ownerMemberId: 'member-1' });
      }
      classificationService.classifyTransaction.mockResolvedValue({ categoryId: 'cat-1' });
    });

    it('finds the account by the statement number and keeps the match', async () => {
      parsedStatement.metadata.accountNumber = 'DE00 0000 0000 0001';
      walletRepository.find.mockResolvedValueOnce([
        { id: 'wallet-everyday', accountNumber: '0001', currency: 'USD', isActive: true, ownerMemberId: null },
      ]);

      await service.processStatement(statement.id);

      expect(statement.walletId).toBe('wallet-everyday');
      expect(savedTransactions.every(row => row.walletId === 'wallet-everyday')).toBe(true);
      parsedStatement.metadata.accountNumber = '';
    });

    it('leaves rows without an account when nothing matches', async () => {
      await service.processStatement(statement.id);

      expect(statement.walletId).toBeNull();
      expect(savedTransactions.every(row => row.walletId === undefined)).toBe(true);
    });
  });

  it('writes every transaction in one database transaction', async () => {
    await service.processStatement(statement.id);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    // Classification must stay outside the write transaction to keep it short.
    expect(classificationService.classifyTransaction).toHaveBeenCalledTimes(2);
    expect(savedTransactions).toHaveLength(2);
  });

  it('stamps a fingerprint on every transaction', async () => {
    await service.processStatement(statement.id);

    expect(transactionFingerprintService.generateFingerprint).toHaveBeenCalledWith(
      expect.objectContaining({ documentNumber: 'DOC-1' }),
      'Unknown',
    );
    expect(savedTransactions.map(tx => tx.fingerprint)).toEqual(['fp-DOC-1', 'fp-DOC-2']);
  });

  it('flags transactions whose fingerprint already exists in the workspace', async () => {
    transactionFingerprintService.findByFingerprints.mockResolvedValueOnce([
      { id: 'tx-existing', fingerprint: 'fp-DOC-1' } as Transaction,
    ]);

    await service.processStatement(statement.id);

    // Flagged, not dropped: the row is still persisted for traceability.
    expect(savedTransactions).toHaveLength(2);
    expect(savedTransactions[0]).toMatchObject({
      documentNumber: 'DOC-1',
      isDuplicate: true,
      duplicateOfId: 'tx-existing',
    });
    expect(savedTransactions[1].isDuplicate).toBeUndefined();
    expect(statement.parsingDetails?.transactionsFlaggedDuplicate).toBe(1);
  });

  it('flags the second occurrence when one batch repeats a fingerprint', async () => {
    transactionFingerprintService.generateFingerprint.mockReturnValue('fp-same');

    await service.processStatement(statement.id);

    expect(savedTransactions[0].isDuplicate).toBeUndefined();
    expect(savedTransactions[1].isDuplicate).toBe(true);
    expect(statement.parsingDetails?.transactionsFlaggedDuplicate).toBe(1);
  });

  it('flags a row repeating one booked by hand, before anything is saved', async () => {
    const manualRowDuplicates = {
      flagRepeats: vi.fn(async (drafts: Transaction[]) => {
        drafts[0].isDuplicate = true;
        drafts[0].duplicateOfId = 'tx-receipt';
        return 1;
      }),
    };
    const withManualCheck = new StatementProcessingService(
      statementRepository as any,
      transactionRepository as any,
      { findOne: vi.fn().mockResolvedValue({ name: 'User' }) } as any,
      parserFactory as any,
      classificationService as any,
      metadataExtractionService as any,
      importSessionService as any,
      transactionFingerprintService as any,
      dataSource as any,
      { resolve: vi.fn(async () => ({ taxRateId: null, taxReverseCharge: false })) } as any,
      undefined,
      undefined,
      undefined,
      undefined,
      manualRowDuplicates as any,
    );

    await withManualCheck.processStatement(statement.id);

    expect(manualRowDuplicates.flagRepeats).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ documentNumber: 'DOC-1' })]),
      statement.workspaceId,
    );
    expect(savedTransactions[0]).toMatchObject({ isDuplicate: true, duplicateOfId: 'tx-receipt' });
    // The statement's count includes these, next to any the fingerprint found.
    expect(statement.parsingDetails?.transactionsFlaggedDuplicate).toBe(
      savedTransactions.filter(row => row.isDuplicate).length,
    );
  });

  it('fails the whole statement when the write transaction fails', async () => {
    dataSource.transaction.mockRejectedValueOnce(new Error('deadlock detected'));

    await expect(service.processStatement(statement.id)).rejects.toThrow('deadlock detected');

    expect(savedTransactions).toHaveLength(0);
    expect(statement.status).toBe(StatementStatus.ERROR);
    expect(statement.errorMessage).toBe('deadlock detected');
  });

  describe('failure notifications', () => {
    let emit: Mock;
    beforeEach(() => {
      emit = vi.fn();
      (service as any).eventEmitter = { emit };
    });
    const parsingErrors = () => emit.mock.calls.filter(([name]) => name === 'parsing.error');

    it('records a failure the queue will retry without telling the user yet', async () => {
      dataSource.transaction.mockRejectedValueOnce(new Error('deadlock detected'));

      await expect(
        service.processStatement(statement.id, { finalAttempt: false }),
      ).rejects.toThrow('deadlock detected');

      expect(statement.status).toBe(StatementStatus.ERROR);
      expect(parsingErrors()).toHaveLength(0);
    });

    it('tells the user once the last attempt fails', async () => {
      dataSource.transaction.mockRejectedValueOnce(new Error('deadlock detected'));

      await expect(
        service.processStatement(statement.id, { finalAttempt: true }),
      ).rejects.toThrow('deadlock detected');

      expect(parsingErrors()).toHaveLength(1);
    });

    it('rejects a file no parser accepts, and tells the user on the first attempt', async () => {
      parserFactory.getParser.mockResolvedValueOnce(null as never);

      const failure = service.processStatement(statement.id, { finalAttempt: false });

      await expect(failure).rejects.toBeInstanceOf(StatementRejected);
      await expect(failure).rejects.toThrow('No parser found');
      expect(statement.status).toBe(StatementStatus.ERROR);
      expect(parsingErrors()).toHaveLength(1);
    });
  });

  it('imports without a fingerprint rather than failing when generation throws', async () => {
    transactionFingerprintService.generateFingerprint.mockImplementationOnce(() => {
      throw new Error('bad date');
    });

    await service.processStatement(statement.id);

    expect(savedTransactions).toHaveLength(2);
    expect(savedTransactions[0].fingerprint).toBeNull();
    expect(statement.status).toBe(StatementStatus.COMPLETED);
  });

  it('holds the statement for review when the balance does not reconcile', async () => {
    parserFactory.getParser.mockResolvedValueOnce({
      parse: vi.fn().mockResolvedValue({
        ...parsedStatement,
        // 1000 + 200 credit - 100 debit = 1100, but the bank reports 1500.
        metadata: { ...parsedStatement.metadata, balanceStart: 1000, balanceEnd: 1500 },
      }),
      constructor: { name: 'FakeParser' },
    });

    await service.processStatement(statement.id);

    expect(statement.status).toBe(StatementStatus.NEEDS_REVIEW);
    expect(statement.parsingDetails?.validation?.passed).toBe(false);
    expect(statement.parsingDetails?.validation?.balanceCheck).toMatchObject({
      expectedEnd: 1100,
      actualEnd: 1500,
      difference: 400,
    });
    // Transactions are still persisted — only their visibility is withheld.
    expect(savedTransactions).toHaveLength(2);
  });

  it('completes the statement when the balance reconciles', async () => {
    parserFactory.getParser.mockResolvedValueOnce({
      parse: vi.fn().mockResolvedValue({
        ...parsedStatement,
        metadata: { ...parsedStatement.metadata, balanceStart: 1000, balanceEnd: 1100 },
      }),
      constructor: { name: 'FakeParser' },
    });

    await service.processStatement(statement.id);

    expect(statement.status).toBe(StatementStatus.COMPLETED);
    expect(statement.parsingDetails?.validation?.passed).toBe(true);
  });

  describe('a file that prints several accounts', () => {
    const otherAccount: ParsedStatement = {
      metadata: { ...parsedStatement.metadata, accountNumber: 'ACC-2', currency: 'EUR' },
      transactions: [parsedStatement.transactions[0]],
    };
    const twoAccounts = () =>
      parserFactory.getParser.mockResolvedValueOnce({
        parse: vi.fn().mockResolvedValue({
          ...parsedStatement,
          metadata: { ...parsedStatement.metadata, accountNumber: 'ACC-1', currency: 'USD' },
          otherAccounts: [otherAccount],
        }),
        constructor: { name: 'FakeParser' },
      });

    afterEach(() => {
      statement.sourceAccountIndex = null;
    });

    it('imports the first account into the upload and lists the others', async () => {
      twoAccounts();

      await service.processStatement(statement.id);

      expect(statement.accountNumber).toBe('ACC-1');
      expect(savedTransactions).toHaveLength(parsedStatement.transactions.length);
      expect(statement.status).toBe(StatementStatus.COMPLETED);
      expect(statement.parsingDetails?.otherAccounts).toEqual([
        { index: 1, accountNumber: 'ACC-2', currency: 'EUR', transactions: 1 },
      ]);
    });

    it('imports only its own account into a statement made for one of the others', async () => {
      twoAccounts();
      statement.sourceAccountIndex = 1;

      await service.processStatement(statement.id);

      expect(statement.accountNumber).toBe('ACC-2');
      expect(statement.currency).toBe('EUR');
      expect(savedTransactions).toHaveLength(otherAccount.transactions.length);
      expect(statement.parsingDetails?.otherAccounts).toBeUndefined();
    });
  });

  it('completes the statement when the bank gave no balances to check', async () => {
    await service.processStatement(statement.id);

    expect(statement.status).toBe(StatementStatus.COMPLETED);
    expect(statement.parsingDetails?.validation?.balanceCheck).toBeUndefined();
  });

  it('guesses no category: neither for the rows nor for the statement as a whole', async () => {
    statement.categoryId = null;
    classificationService.classifyTransaction.mockResolvedValue({} as any);

    await service.processStatement(statement.id);

    expect(savedTransactions[0].categoryId).toBeUndefined();
    expect(savedTransactions[1].categoryId).toBeUndefined();
    expect(statement.categoryId).toBeNull();
  });

  it('skips automatic category assignment when manual category selection is required', async () => {
    statement.parsingDetails = {
      manualCategorySelectionRequired: true,
    } as Statement['parsingDetails'];
    statement.categoryId = null;
    classificationService.classifyTransaction.mockResolvedValue({ categoryId: 'cat-1' });

    await service.processStatement(statement.id);

    expect(savedTransactions[0].categoryId).toBeUndefined();
    expect(savedTransactions[1].categoryId).toBeUndefined();
    expect(statement.categoryId).toBeNull();
  });

  it('returns completed statement when import preview missing', async () => {
    statement.status = StatementStatus.COMPLETED;
    statement.parsingDetails = {
      importCommit: { committed: 2 },
    } as Statement['parsingDetails'];

    await expect(service.commitImport(statement.id, statement.workspaceId)).resolves.toBe(
      statement,
    );
    expect(importSessionService.processImport).not.toHaveBeenCalled();
  });

  it('returns statement when parsed but transactions already exist', async () => {
    statement.status = StatementStatus.PARSED;
    statement.totalTransactions = 0;
    statement.parsingDetails = null;
    transactionRepository.count.mockResolvedValueOnce(2);

    await expect(service.commitImport(statement.id, statement.workspaceId)).resolves.toBe(
      statement,
    );
    expect(importSessionService.processImport).not.toHaveBeenCalled();
  });

  it('answers 409 when there is nothing previewed to commit', async () => {
    statement.status = StatementStatus.PARSED;
    statement.parsingDetails = null;
    transactionRepository.count.mockResolvedValueOnce(0);

    await expect(service.commitImport(statement.id, statement.workspaceId)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(importSessionService.processImport).not.toHaveBeenCalled();
  });

  it('keeps all dropped samples so every warning row remains repairable', async () => {
    const manyInvalidTransactions = Array.from({ length: 12 }, (_, index) => ({
      transactionDate: new Date('2024-01-05'),
      documentNumber: `DOC-${index + 1}`,
      counterpartyName: `Counterparty ${index + 1}`,
      paymentPurpose: `Purpose ${index + 1}`,
      debit: 0,
      credit: 0,
      currency: 'KZT',
    }));

    parserFactory.getParser.mockResolvedValueOnce({
      parse: vi.fn().mockResolvedValue({
        metadata: parsedStatement.metadata,
        transactions: manyInvalidTransactions,
      }),
      constructor: { name: 'FakeParser' },
    });

    await service.processStatement(statement.id);

    // 12 per-row "skipped" warnings from schema enforcement, plus one
    // statement-level warning for the 100%-dropped batch (see below).
    expect(statement.parsingDetails?.warnings).toHaveLength(13);
    expect(statement.parsingDetails?.droppedSamples).toHaveLength(12);
    expect(statement.status).toBe(StatementStatus.NEEDS_REVIEW);
  });

  it('holds a statement for review when every parsed row is rejected by schema validation', async () => {
    const allInvalidTransactions = Array.from({ length: 3 }, (_, index) => ({
      transactionDate: new Date('2024-01-05'),
      documentNumber: `DOC-${index + 1}`,
      counterpartyName: `Counterparty ${index + 1}`,
      paymentPurpose: `Purpose ${index + 1}`,
      debit: 0,
      credit: 0,
      currency: 'KZT',
    }));

    parserFactory.getParser.mockResolvedValueOnce({
      parse: vi.fn().mockResolvedValue({
        metadata: parsedStatement.metadata,
        transactions: allInvalidTransactions,
      }),
      constructor: { name: 'FakeParser' },
    });

    await service.processStatement(statement.id);

    expect(statement.status).toBe(StatementStatus.NEEDS_REVIEW);
    expect(statement.parsingDetails?.validation?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('zero transactions')]),
    );
    expect(savedTransactions).toHaveLength(0);
  });

  it('holds a statement for review when most parsed rows are rejected by schema validation', async () => {
    const mostlyInvalidTransactions = [
      ...Array.from({ length: 9 }, (_, index) => ({
        transactionDate: new Date('2024-01-05'),
        documentNumber: `BAD-${index + 1}`,
        counterpartyName: `Counterparty ${index + 1}`,
        paymentPurpose: `Purpose ${index + 1}`,
        debit: 0,
        credit: 0,
        currency: 'KZT',
      })),
      ...parsedStatement.transactions,
    ];

    parserFactory.getParser.mockResolvedValueOnce({
      parse: vi.fn().mockResolvedValue({
        metadata: parsedStatement.metadata,
        transactions: mostlyInvalidTransactions,
      }),
      constructor: { name: 'FakeParser' },
    });

    await service.processStatement(statement.id);

    expect(statement.status).toBe(StatementStatus.NEEDS_REVIEW);
    expect(statement.parsingDetails?.validation?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('9 of 11 parsed rows were rejected')]),
    );
    expect(savedTransactions).toHaveLength(2);
  });

  it('does not flag a legitimately empty statement that has no transactions but reconciled balances', async () => {
    parserFactory.getParser.mockResolvedValueOnce({
      parse: vi.fn().mockResolvedValue({
        metadata: { ...parsedStatement.metadata, balanceStart: 500, balanceEnd: 500 },
        transactions: [],
      }),
      constructor: { name: 'FakeParser' },
    });

    await service.processStatement(statement.id);

    expect(statement.status).toBe(StatementStatus.COMPLETED);
    expect(savedTransactions).toHaveLength(0);
  });

  it('holds a statement for review instead of comparing mixed-currency totals against a single balance', async () => {
    parserFactory.getParser.mockResolvedValueOnce({
      parse: vi.fn().mockResolvedValue({
        metadata: { ...parsedStatement.metadata, balanceStart: 1000, balanceEnd: 1100 },
        transactions: [
          { ...parsedStatement.transactions[0], currency: 'USD', debit: 100, credit: undefined },
          { ...parsedStatement.transactions[1], currency: 'EUR', debit: undefined, credit: 200 },
        ],
      }),
      constructor: { name: 'FakeParser' },
    });

    await service.processStatement(statement.id);

    expect(statement.status).toBe(StatementStatus.NEEDS_REVIEW);
    expect(statement.parsingDetails?.validation?.balanceCheck).toBeUndefined();
    expect(statement.parsingDetails?.validation?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('multiple currencies')]),
    );
    // Transactions are still persisted — only their visibility is withheld.
    expect(savedTransactions).toHaveLength(2);
  });

  it('holds a statement for review when it has no transactions and only one balance was extracted', async () => {
    parserFactory.getParser.mockResolvedValueOnce({
      parse: vi.fn().mockResolvedValue({
        metadata: { ...parsedStatement.metadata, balanceStart: 1000, balanceEnd: undefined },
        transactions: [],
      }),
      constructor: { name: 'FakeParser' },
    });

    await service.processStatement(statement.id);

    expect(statement.status).toBe(StatementStatus.NEEDS_REVIEW);
    expect(statement.parsingDetails?.validation?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('No transactions or balances')]),
    );
  });

  it('keeps parser metadata when enrichment only has fallback values', async () => {
    parserFactory.getParser.mockResolvedValueOnce({
      parse: vi.fn().mockResolvedValue({
        ...parsedStatement,
        metadata: {
          ...parsedStatement.metadata,
          accountNumber: 'PARSER-ACCOUNT',
          dateFrom: new Date('2024-01-01'),
          dateTo: new Date('2024-01-31'),
          currency: 'USD',
        },
      }),
      constructor: { name: 'FakeParser' },
    });
    metadataExtractionService.extractMetadata.mockResolvedValueOnce({} as any);
    metadataExtractionService.convertToParsedStatementMetadata.mockReturnValueOnce({
      accountNumber: '',
      dateFrom: new Date('2026-08-01'),
      dateTo: new Date('2026-08-03'),
      currency: 'KZT',
    });

    await service.processStatement(statement.id);

    expect(statement.accountNumber).toBe('PARSER-ACCOUNT');
    expect(statement.currency).toBe('USD');
    expect(statement.statementDateFrom?.toISOString()).toContain('2024-01-01');
  });
});
