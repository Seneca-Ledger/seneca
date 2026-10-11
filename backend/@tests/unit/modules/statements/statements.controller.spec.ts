jest.mock('franc', () => ({
  franc: () => 'und',
}));

import type { IdempotencyService } from '@/common/services/idempotency.service';
import { buildContentDisposition } from '@/common/utils/http-file.util';
import { StatementStatus } from '@/entities/statement.entity';
import type { User } from '@/entities/user.entity';
import { FilterStatementsDto } from '@/modules/statements/dto/filter-statements.dto';
import { ReceiptStatementService } from '@/modules/statements/services/receipt-statement.service';
import { StatementsController } from '@/modules/statements/statements.controller';
import type { StatementsService } from '@/modules/statements/statements.service';
import type { Response } from 'express';
import type { ConvertDroppedSampleBody, UploadReceiptScanBody, UploadStatementBody } from '../../../../src/contracts';

type MockResponse = {
  headersSent: boolean;
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
  destroy: jest.Mock;
};

describe('StatementsController', () => {
  const statementsService = {
    create: jest.fn(),
    createFromReceiptScan: jest.fn(),
    createManualExpense: jest.fn(),
    findAll: jest.fn(),
    convertDroppedSampleToTransaction: jest.fn(),
    getFileStream: jest.fn(),
  };

  const idempotencyService = {
    checkKey: jest.fn(),
    storeKey: jest.fn(),
  };

  const receiptStatementService = {
    createFromReceiptScan: jest.fn(),
  };

  const controller = new StatementsController(
    statementsService as unknown as StatementsService,
    receiptStatementService as unknown as ReceiptStatementService,
    idempotencyService as unknown as IdempotencyService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    idempotencyService.checkKey.mockResolvedValue(null);
    idempotencyService.storeKey.mockResolvedValue(undefined);
  });

  it('returns uploaded statements immediately without waiting for parsing', async () => {
    const createdStatement = {
      id: 'stmt-1',
      status: StatementStatus.UPLOADED,
      parsingDetails: null,
    };

    statementsService.create.mockResolvedValue(createdStatement);
    const file = {
      originalname: 'test.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      path: '/tmp/test.pdf',
    };
    const currentUser = { id: 'user-1' } as User;

    const result = await controller.upload(
      [file as Express.Multer.File],
      {} as UploadStatementBody,
      currentUser,
      'ws-1',
    );

    expect(statementsService.create).toHaveBeenCalledTimes(1);
    expect(receiptStatementService.createFromReceiptScan).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      cached: false,
      data: [
        {
          id: 'stmt-1',
          status: StatementStatus.UPLOADED,
        },
      ],
    });
  });

  it('manual expense with a repeated idempotency key returns the cached result once', async () => {
    const created = { id: 'stmt-manual-1', status: StatementStatus.PROCESSED };
    statementsService.createManualExpense.mockResolvedValue(created);
    const currentUser = { id: 'user-1' } as User;
    const payload = { amount: 5000, description: 'Такси' } as any;

    const first = await controller.createManualExpense([], payload, currentUser, 'ws-1', 'key-1');
    expect(first).toEqual(created);
    expect(idempotencyService.checkKey).toHaveBeenCalledWith('key-1', 'user-1', 'ws-1');
    expect(idempotencyService.storeKey).toHaveBeenCalledWith('key-1', 'user-1', 'ws-1', created);

    idempotencyService.checkKey.mockResolvedValueOnce({ data: created, cached: true });
    const second = await controller.createManualExpense([], payload, currentUser, 'ws-1', 'key-1');
    expect(second).toMatchObject({ id: 'stmt-manual-1', cached: true });
    expect(statementsService.createManualExpense).toHaveBeenCalledTimes(1);
  });

  it('manual expense without a key never touches the idempotency service', async () => {
    statementsService.createManualExpense.mockResolvedValue({ id: 'stmt-manual-2' });
    const currentUser = { id: 'user-1' } as User;

    await controller.createManualExpense([], {} as any, currentUser, 'ws-1');

    expect(idempotencyService.checkKey).not.toHaveBeenCalled();
    expect(idempotencyService.storeKey).not.toHaveBeenCalled();
  });

  it('passes filter dto to findAll and keeps items alias', async () => {
    statementsService.findAll.mockResolvedValue({
      data: [{ id: 'stmt-1' }],
      total: 1,
      page: 2,
      limit: 10,
    });

    const filters = {
      page: 2,
      limit: 10,
      search: 'abc',
      categoryId: 'cat-1',
      type: 'pdf',
      statuses: ['processing', 'error'],
    } as FilterStatementsDto;
    const currentUser = { id: 'user-1' } as User;

    const result = await controller.findAll(currentUser, 'ws-1', filters);

    expect(statementsService.findAll).toHaveBeenCalledWith('ws-1', filters);
    expect(result).toEqual({
      data: [{ id: 'stmt-1' }],
      items: [{ id: 'stmt-1' }],
      total: 1,
      page: 2,
      limit: 10,
    });
  });

  it('converts a dropped sample into a transaction', async () => {
    const response = {
      statement: { id: 'stmt-1' },
      transaction: { id: 'tx-1' },
    };
    const payload: ConvertDroppedSampleBody = {
      index: 0,
      transaction: {
        transactionDate: '2026-03-17',
        debit: 1250,
      },
    };
    const currentUser = { id: 'user-1' } as User;

    statementsService.convertDroppedSampleToTransaction.mockResolvedValue(response);

    const result = await controller.convertDroppedSample('stmt-1', payload, currentUser, 'ws-1');

    expect(statementsService.convertDroppedSampleToTransaction).toHaveBeenCalledWith(
      'stmt-1',
      'user-1',
      'ws-1',
      expect.objectContaining({
        index: 0,
        transaction: expect.objectContaining({ debit: 1250 }),
      }),
    );
    expect(result).toEqual(response);
  });

  it('delegates receipt scan uploads to the receipt scan statement flow', async () => {
    const createdStatement = { id: 'stmt-receipt-1', status: StatementStatus.COMPLETED };
    receiptStatementService.createFromReceiptScan.mockResolvedValue([createdStatement]);

    const file = {
      originalname: 'receipt.jpg',
      mimetype: 'image/jpeg',
      size: 1024,
      path: '/tmp/receipt.jpg',
    };
    const currentUser = { id: 'user-1' } as User;

    const result = await controller.uploadReceipt(
      [file as Express.Multer.File],
      { language: 'ru' } as UploadReceiptScanBody,
      currentUser,
      'ws-1',
    );

    expect(receiptStatementService.createFromReceiptScan).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      workspaceId: 'ws-1',
      files: [file],
      language: 'ru',
    });
    expect(result).toEqual({ data: [createdStatement] });
  });

  it('allows receipt scan uploads without optional language', async () => {
    const createdStatement = { id: 'stmt-receipt-2', status: StatementStatus.COMPLETED };
    receiptStatementService.createFromReceiptScan.mockResolvedValue([createdStatement]);

    const file = {
      originalname: 'receipt.pdf',
      mimetype: 'application/pdf',
      size: 1024,
      path: '/tmp/receipt.pdf',
    };
    const currentUser = { id: 'user-1' } as User;

    const result = await controller.uploadReceipt(
      [file as Express.Multer.File],
      {} as UploadReceiptScanBody,
      currentUser,
      'ws-1',
    );

    expect(receiptStatementService.createFromReceiptScan).toHaveBeenCalledWith({
      user: { id: 'user-1' },
      workspaceId: 'ws-1',
      files: [file],
      language: undefined,
    });
    expect(result).toEqual({ data: [createdStatement] });
  });

  it('streams statement downloads with shared file response handling', async () => {
    const handlers: Record<string, (error: NodeJS.ErrnoException) => void> = {};
    const stream = {
      on: jest.fn((event: string, handler: (error: NodeJS.ErrnoException) => void) => {
        handlers[event] = handler;
      }),
      pipe: jest.fn(),
    };
    const response: MockResponse = {
      headersSent: false,
      setHeader: jest.fn(),
      status: jest.fn(),
      json: jest.fn(),
      destroy: jest.fn(),
    };
    const currentUser = { id: 'user-1' } as User;

    response.status.mockReturnValue(response);

    statementsService.getFileStream.mockResolvedValue({
      stream,
      fileName: 'statement.pdf',
      mimeType: 'application/pdf',
    });

    await controller.getFile('stmt-1', currentUser, 'ws-1', response as unknown as Response);

    expect(statementsService.getFileStream).toHaveBeenCalledWith('stmt-1', 'ws-1');
    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      buildContentDisposition('attachment', 'statement.pdf'),
    );
    expect(stream.pipe).toHaveBeenCalledWith(response);

    handlers.error?.({ code: 'ENOENT' } as NodeJS.ErrnoException);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_FOUND',
        message: 'File not found on disk',
      },
    });
  });
});
