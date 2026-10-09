import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  Category,
  Receipt,
  ReceiptProcessingJob,
  Statement,
  ReceiptSource,
  ReceiptStatus,
  Transaction,
} from '../../../../src/entities';
import { ActorType, AuditAction, EntityType } from '../../../../src/entities/audit-event.entity';
import { AuditService } from '../../../../src/modules/audit/audit.service';
import { ReceiptsService } from '../../../../src/modules/receipts/receipts.service';
import { ReceiptProcessorService } from '../../../../src/modules/receipts/services/receipt-processor.service';
import { workspaceCurrencyProvider } from '../../../helpers/workspace-currency-stub';

describe('ReceiptsService', () => {
  let service: ReceiptsService;
  let receiptRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findAndCount: jest.Mock;
    findOne: jest.Mock;
    delete: jest.Mock;
  };
  let jobRepository: { create: jest.Mock; save: jest.Mock };
  let transactionRepository: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    findOne: jest.Mock;
  };
  let statementRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    remove: jest.Mock;
    update: jest.Mock;
  };
  let categoryRepository: { find: jest.Mock; findOne: jest.Mock };
  let processorService: { processReceipt: jest.Mock };
  let mockEventEmitter: { emit: jest.Mock; emitAsync: jest.Mock };
  let auditService: { createEvent: jest.Mock; createBatchEvents: jest.Mock };

  beforeEach(async () => {
    receiptRepository = {
      create: jest.fn().mockImplementation(payload => payload),
      save: jest.fn().mockImplementation(async payload => ({ id: 'receipt-1', ...payload })),
      findAndCount: jest.fn().mockResolvedValue([[{ id: 'receipt-1' }], 1]),
      findOne: jest.fn().mockResolvedValue({
        id: 'receipt-1',
        status: ReceiptStatus.DRAFT,
        source: ReceiptSource.UPLOAD,
      }),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    jobRepository = {
      create: jest.fn().mockImplementation(payload => payload),
      save: jest.fn().mockImplementation(async payload => ({ id: 'job-1', ...payload })),
    };

    transactionRepository = {
      create: jest.fn().mockImplementation(payload => payload),
      save: jest.fn().mockImplementation(async payload => ({ id: 'tx-1', ...payload })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      findOne: jest.fn().mockResolvedValue(null),
    };
    // approveOnce runs inside a DB transaction; the fake manager hands back the same mocks.
    Object.assign(receiptRepository, {
      manager: {
        transaction: jest.fn(async (work: (manager: unknown) => unknown) =>
          work({
            getRepository: (entity: unknown) =>
              entity === Receipt ? receiptRepository : transactionRepository,
          }),
        ),
      },
    });

    statementRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation(async payload => payload),
      remove: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    categoryRepository = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };

    processorService = {
      processReceipt: jest.fn().mockResolvedValue(undefined),
    };

    auditService = {
      createEvent: jest.fn().mockResolvedValue({}),
      createBatchEvents: jest.fn().mockResolvedValue({ batchId: 'batch-1', events: [] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiptsService,
        workspaceCurrencyProvider(),
        { provide: getRepositoryToken(Receipt), useValue: receiptRepository },
        { provide: getRepositoryToken(ReceiptProcessingJob), useValue: jobRepository },
        { provide: getRepositoryToken(Transaction), useValue: transactionRepository },
        { provide: getRepositoryToken(Statement), useValue: statementRepository },
        { provide: getRepositoryToken(Category), useValue: categoryRepository },
        { provide: ReceiptProcessorService, useValue: processorService },
        { provide: AuditService, useValue: auditService },
        {
          provide: EventEmitter2,
          useValue: (mockEventEmitter = { emit: jest.fn(), emitAsync: jest.fn().mockResolvedValue([]) }),
        },
      ],
    }).compile();

    service = module.get(ReceiptsService);
  });

  it('creates upload receipt, creates a processing job, and processes it', async () => {
    const result = await service.createFromUpload({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      files: [
        {
          originalname: 'receipt.jpg',
          filename: 'stored.jpg',
          path: '/tmp/stored.jpg',
          mimetype: 'image/jpeg',
          size: 123,
        } as Express.Multer.File,
      ],
      language: 'eng',
    });

    expect(receiptRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        workspaceId: 'workspace-1',
        source: ReceiptSource.UPLOAD,
        status: ReceiptStatus.NEW,
        language: 'eng',
      }),
    );
    expect(jobRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        receiptId: 'receipt-1',
      }),
    );
    expect(processorService.processReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        receiptId: 'receipt-1',
        payload: expect.objectContaining({ historyId: 'eng' }),
      }),
    );
    expect(result).toMatchObject({ id: 'receipt-1', status: ReceiptStatus.DRAFT });
  });

  it('creates scan receipt and processes it', async () => {
    const result = await service.createFromScan({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      file: {
        originalname: 'scan.jpg',
        filename: 'scan-stored.jpg',
        path: '/tmp/scan-stored.jpg',
        mimetype: 'image/jpeg',
        size: 321,
      } as Express.Multer.File,
      language: 'auto',
    });

    expect(receiptRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ source: ReceiptSource.SCAN }),
    );
    expect(processorService.processReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ integrationId: 'manual-scan', historyId: 'auto' }),
      }),
    );
    expect(result).toMatchObject({ id: 'receipt-1' });
  });

  it('keeps the device point sent with a scan in receipt metadata', async () => {
    await service.createFromScan({
      userId: 'user-1',
      workspaceId: 'workspace-1',
      file: {
        originalname: 'scan.jpg',
        filename: 'scan-stored.jpg',
        path: '/tmp/scan-stored.jpg',
        mimetype: 'image/jpeg',
        size: 321,
      } as Express.Multer.File,
      captureLocation: { lat: 43.2383, lng: 76.9453, accuracyM: 12 },
    });

    expect(receiptRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          captureLocation: {
            lat: 43.2383,
            lng: 76.9453,
            accuracyM: 12,
            source: 'device',
            capturedAt: expect.any(String),
          },
        }),
      }),
    );
  });

  it('lists receipts by workspace with filters', async () => {
    const result = await service.findAll('workspace-1', {
      page: 2,
      limit: 10,
      source: ReceiptSource.SCAN,
      status: ReceiptStatus.NEEDS_REVIEW,
    });

    expect(receiptRepository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          source: ReceiptSource.SCAN,
          status: ReceiptStatus.NEEDS_REVIEW,
        }),
        skip: 10,
        take: 10,
      }),
    );
    expect(result).toEqual({
      data: [{ id: 'receipt-1', category: null }],
      total: 1,
      page: 2,
      limit: 10,
    });
  });

  it('resolves the picked category name for listed receipts', async () => {
    receiptRepository.findAndCount.mockResolvedValue([
      [{ id: 'receipt-1', parsedData: { categoryId: 'cat-1' } }],
      1,
    ]);
    categoryRepository.find.mockResolvedValue([{ id: 'cat-1', name: 'Interest income' }]);

    const result = await service.findAll('workspace-1', {});

    expect(result.data[0]).toMatchObject({
      id: 'receipt-1',
      category: { id: 'cat-1', name: 'Interest income' },
    });
  });

  it('propagates a picked category to the linked statement and its scan transaction', async () => {
    receiptRepository.findOne.mockResolvedValue({
      id: 'receipt-1',
      workspaceId: 'workspace-1',
      statementId: 'statement-1',
      parsedData: { vendor: 'Lidl' },
    });
    categoryRepository.findOne.mockResolvedValue({ id: 'cat-1' });
    statementRepository.findOne.mockResolvedValue({
      id: 'statement-1',
      parsingDetails: { detectedBy: 'receipt-scan' },
    });

    await service.update('receipt-1', 'workspace-1', { parsedData: { categoryId: 'cat-1' } });

    expect(statementRepository.update).toHaveBeenCalledWith(
      { id: 'statement-1', workspaceId: 'workspace-1' },
      { categoryId: 'cat-1' },
    );
    expect(transactionRepository.update).toHaveBeenCalledWith(
      { statementId: 'statement-1', workspaceId: 'workspace-1' },
      { categoryId: 'cat-1' },
    );
  });

  it('leaves transactions of a parsed bank statement alone', async () => {
    receiptRepository.findOne.mockResolvedValue({
      id: 'receipt-1',
      workspaceId: 'workspace-1',
      statementId: 'statement-1',
      parsedData: { vendor: 'Lidl' },
    });
    categoryRepository.findOne.mockResolvedValue({ id: 'cat-1' });
    statementRepository.findOne.mockResolvedValue({
      id: 'statement-1',
      parsingDetails: { detectedBy: 'kaspi-parser' },
    });

    await service.update('receipt-1', 'workspace-1', { parsedData: { categoryId: 'cat-1' } });

    expect(statementRepository.update).toHaveBeenCalled();
    expect(transactionRepository.update).not.toHaveBeenCalled();
  });

  it('leaves the statement alone when the receipt has no category', async () => {
    receiptRepository.findOne.mockResolvedValue({
      id: 'receipt-1',
      workspaceId: 'workspace-1',
      statementId: 'statement-1',
      parsedData: {},
    });

    await service.update('receipt-1', 'workspace-1', { parsedData: { vendor: 'Lidl' } });

    expect(statementRepository.update).not.toHaveBeenCalled();
  });

  it('approves receipt and creates transaction', async () => {
    const receipt = {
      id: 'receipt-approve-1',
      workspaceId: 'workspace-1',
      status: ReceiptStatus.DRAFT,
      parsedData: {
        amount: 99.5,
        currency: 'EUR',
        vendor: 'Lidl',
        date: '2026-03-20',
        categoryId: 'cat-1',
        transactionType: 'expense',
      },
      subject: 'receipt.jpg',
      transactionId: null,
    } as unknown as Receipt;

    receiptRepository.findOne.mockResolvedValue(receipt);

    const result = await service.approve('receipt-approve-1', 'workspace-1', 'user-1');

    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        amount: 99.5,
        currency: 'EUR',
        counterpartyName: 'Lidl',
      }),
    );
    expect(receiptRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ReceiptStatus.APPROVED,
        transactionId: 'tx-1',
      }),
    );
    expect(result).toMatchObject({ transaction: { id: 'tx-1' } });
    expect(mockEventEmitter.emitAsync).toHaveBeenCalledWith(
      'receipt.approved',
      expect.objectContaining({ receiptId: expect.any(String) }),
    );
  });

  it('approving an approved receipt again returns its transaction instead of booking a second', async () => {
    const receipt = {
      id: 'receipt-approved',
      workspaceId: 'workspace-1',
      status: ReceiptStatus.APPROVED,
      parsedData: { amount: 12, currency: 'EUR', vendor: 'Lidl', date: '2026-03-20' },
      subject: 'receipt.jpg',
      transactionId: 'tx-existing',
    } as unknown as Receipt;
    receiptRepository.findOne.mockResolvedValue(receipt);
    transactionRepository.findOne.mockResolvedValue({ id: 'tx-existing' });

    const result = await service.approve('receipt-approved', 'workspace-1', 'user-1');

    expect(result).toMatchObject({ transaction: { id: 'tx-existing' } });
    expect(transactionRepository.save).not.toHaveBeenCalled();
    expect(mockEventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('locks the receipt row while approving', async () => {
    receiptRepository.findOne.mockResolvedValue({
      id: 'receipt-lock',
      workspaceId: 'workspace-1',
      parsedData: { amount: 5, date: '2026-03-20' },
      transactionId: null,
    });

    await service.approve('receipt-lock', 'workspace-1', 'user-1');

    expect(receiptRepository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
  });

  it('bulk approve skips creating a transaction for an already approved receipt', async () => {
    const approved = {
      id: 'receipt-approved',
      workspaceId: 'workspace-1',
      status: ReceiptStatus.APPROVED,
      parsedData: { amount: 12, currency: 'EUR', vendor: 'Lidl', date: '2026-03-20' },
      subject: 'receipt.jpg',
      transactionId: 'tx-existing',
    } as unknown as Receipt;
    receiptRepository.findOne.mockResolvedValue(approved);
    transactionRepository.findOne.mockResolvedValue({ id: 'tx-existing' });

    const result = await service.bulkApprove(['receipt-approved'], 'workspace-1', 'user-1');

    expect(result).toEqual({ approved: 1, failed: 0, errors: [] });
    expect(transactionRepository.save).not.toHaveBeenCalled();
  });

  it('bulk approves receipts and reports missing items', async () => {
    const firstReceipt = {
      id: 'receipt-1',
      workspaceId: 'workspace-1',
      status: ReceiptStatus.DRAFT,
      parsedData: {
        amount: 15.5,
        currency: 'EUR',
        vendor: 'Lidl',
        date: '2026-03-20',
      },
      subject: 'receipt-1.jpg',
    } as unknown as Receipt;

    receiptRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'receipt-1' ? firstReceipt : null,
    );

    const result = await service.bulkApprove(['receipt-1', 'missing-receipt'], 'workspace-1', 'user-1');

    expect(result).toEqual({
      approved: 1,
      failed: 1,
      errors: [{ receiptId: 'missing-receipt', error: 'Receipt not found' }],
    });
    expect(transactionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        amount: 15.5,
        currency: 'EUR',
        counterpartyName: 'Lidl',
      }),
    );
  });

  it('deletes receipt by id and workspace', async () => {
    await service.delete('receipt-1', 'workspace-1', 'user-1');

    expect(receiptRepository.delete).toHaveBeenCalledWith({
      id: 'receipt-1',
      workspaceId: 'workspace-1',
    });
  });

  it('cascades scan receipt deletion to linked statement and attached files', async () => {
    const unlinkSpy = jest.spyOn(require('node:fs').promises, 'unlink').mockResolvedValue(undefined);
    receiptRepository.findOne.mockResolvedValue({
      id: 'receipt-scan-1',
      workspaceId: 'workspace-1',
      source: ReceiptSource.SCAN,
      statementId: 'statement-scan-1',
      attachmentPaths: ['/tmp/receipt-scan.jpg'],
    } as unknown as Receipt);
    statementRepository.findOne.mockResolvedValue({
      id: 'statement-scan-1',
      workspaceId: 'workspace-1',
      filePath: '/tmp/receipt-scan.jpg',
      deletedAt: null,
    } as unknown as Statement);

    await service.delete('receipt-scan-1', 'workspace-1', 'user-1');

    expect(unlinkSpy).toHaveBeenCalledWith('/tmp/receipt-scan.jpg');
    expect(statementRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'statement-scan-1', deletedAt: expect.any(Date) }),
    );
    expect(receiptRepository.delete).toHaveBeenCalledWith({
      id: 'receipt-scan-1',
      workspaceId: 'workspace-1',
    });
  });

  describe('audit', () => {
    const file = {
      originalname: 'receipt.jpg',
      filename: 'stored.jpg',
      mimetype: 'image/jpeg',
      size: 10,
      path: '/tmp/stored.jpg',
    } as Express.Multer.File;

    it('logs an uploaded receipt as a CREATE in its workspace', async () => {
      await service.createFromUpload({ userId: 'user-1', workspaceId: 'workspace-1', files: [file] });

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          actorType: ActorType.USER,
          actorId: 'user-1',
          entityType: EntityType.RECEIPT,
          entityId: 'receipt-1',
          action: AuditAction.CREATE,
          diff: { before: null, after: expect.objectContaining({ status: ReceiptStatus.DRAFT }) },
        }),
      );
    });

    it('logs a scanned receipt once, as the receipt itself', async () => {
      receiptRepository.findOne.mockResolvedValue({
        id: 'receipt-1',
        source: ReceiptSource.SCAN,
        status: ReceiptStatus.NEW,
        subject: 'scan.jpg',
        statementId: 'statement-1',
        attachmentPaths: ['/tmp/stored.jpg'],
      });

      await service.createFromScan({ userId: 'user-1', workspaceId: 'workspace-1', file });

      expect(auditService.createEvent).toHaveBeenCalledTimes(1);
      const event = auditService.createEvent.mock.calls[0][0];
      expect(event).toMatchObject({
        entityType: EntityType.RECEIPT,
        action: AuditAction.CREATE,
        meta: { source: ReceiptSource.SCAN, fileName: 'scan.jpg' },
      });
      // No file paths or binary data end up in the log.
      expect(JSON.stringify(event)).not.toContain('/tmp/stored.jpg');
    });

    it('logs an edit with only the changed fields before and after', async () => {
      receiptRepository.findOne.mockResolvedValue({
        id: 'receipt-1',
        status: ReceiptStatus.DRAFT,
        parsedData: { vendor: 'Aldi', amount: 5 },
      });

      await service.update(
        'receipt-1',
        'workspace-1',
        { status: ReceiptStatus.REVIEWED, parsedData: { vendor: 'Lidl' } },
        'user-1',
      );

      expect(auditService.createEvent).toHaveBeenCalledWith({
        workspaceId: 'workspace-1',
        actorType: ActorType.USER,
        actorId: 'user-1',
        entityType: EntityType.RECEIPT,
        entityId: 'receipt-1',
        action: AuditAction.UPDATE,
        diff: {
          before: { status: ReceiptStatus.DRAFT, parsedData: { vendor: 'Aldi' } },
          after: { status: ReceiptStatus.REVIEWED, parsedData: { vendor: 'Lidl' } },
        },
      });
    });

    it('does not log the internal update without a user', async () => {
      await service.update('receipt-1', 'workspace-1', { statementId: 'statement-1' });

      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('logs an approval that booked a transaction, but not a repeated one', async () => {
      receiptRepository.findOne.mockResolvedValue({
        id: 'receipt-1',
        workspaceId: 'workspace-1',
        status: ReceiptStatus.REVIEWED,
        parsedData: { amount: 5, date: '2026-03-20' },
        transactionId: null,
      });

      await service.approve('receipt-1', 'workspace-1', 'user-1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          entityType: EntityType.RECEIPT,
          entityId: 'receipt-1',
          action: AuditAction.UPDATE,
          diff: {
            before: { status: ReceiptStatus.REVIEWED, transactionId: null },
            after: { status: ReceiptStatus.APPROVED, transactionId: 'tx-1' },
          },
          meta: { approved: true },
        }),
      );

      auditService.createEvent.mockClear();
      transactionRepository.findOne.mockResolvedValue({ id: 'tx-1' });
      await service.approve('receipt-1', 'workspace-1', 'user-1');
      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('logs a bulk approval as one batch of the receipts actually approved', async () => {
      receiptRepository.findOne.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === 'missing'
          ? null
          : {
              id: where.id,
              workspaceId: 'workspace-1',
              status: ReceiptStatus.DRAFT,
              parsedData: { amount: 5, date: '2026-03-20' },
              transactionId: null,
            },
      );

      await service.bulkApprove(['receipt-1', 'missing', 'receipt-2'], 'workspace-1', 'user-1');

      expect(auditService.createBatchEvents).toHaveBeenCalledTimes(1);
      const [events, batchId] = auditService.createBatchEvents.mock.calls[0];
      expect(batchId).toEqual(expect.any(String));
      expect(events.map((event: { entityId: string }) => event.entityId)).toEqual([
        'receipt-1',
        'receipt-2',
      ]);
      expect(events[0]).toMatchObject({
        workspaceId: 'workspace-1',
        actorId: 'user-1',
        action: AuditAction.UPDATE,
        meta: { approved: true },
      });
    });

    it('logs a deletion with the receipt snapshot', async () => {
      receiptRepository.findOne.mockResolvedValue({
        id: 'receipt-1',
        workspaceId: 'workspace-1',
        status: ReceiptStatus.DRAFT,
        source: ReceiptSource.UPLOAD,
        subject: 'receipt.jpg',
        statementId: null,
      });

      await service.delete('receipt-1', 'workspace-1', 'user-1');

      expect(auditService.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          entityId: 'receipt-1',
          action: AuditAction.DELETE,
          diff: {
            before: expect.objectContaining({ subject: 'receipt.jpg' }),
            after: null,
          },
          meta: { statementId: null, statementDeleted: false },
        }),
      );
    });

    it('does not log deleting a receipt that is not in the workspace', async () => {
      receiptRepository.findOne.mockResolvedValue(null);

      await service.delete('receipt-1', 'workspace-1', 'user-1');

      expect(auditService.createEvent).not.toHaveBeenCalled();
    });

    it('never fails the operation when the audit write fails', async () => {
      auditService.createEvent.mockRejectedValue(new Error('audit down'));
      auditService.createBatchEvents.mockRejectedValue(new Error('audit down'));
      receiptRepository.findOne.mockResolvedValue({
        id: 'receipt-1',
        workspaceId: 'workspace-1',
        status: ReceiptStatus.DRAFT,
        parsedData: { amount: 5, date: '2026-03-20' },
        transactionId: null,
      });

      await expect(
        service.update('receipt-1', 'workspace-1', { status: ReceiptStatus.REVIEWED }, 'user-1'),
      ).resolves.toMatchObject({ id: 'receipt-1' });
      await expect(service.bulkApprove(['receipt-1'], 'workspace-1', 'user-1')).resolves.toEqual({
        approved: 1,
        failed: 0,
        errors: [],
      });
      await expect(service.delete('receipt-1', 'workspace-1', 'user-1')).resolves.toEqual({
        success: true,
      });
    });
  });
});
