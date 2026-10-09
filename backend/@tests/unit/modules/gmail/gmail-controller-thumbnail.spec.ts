import * as fs from 'node:fs';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Category, GmailSettings, Receipt, Transaction } from '../../../../src/entities';
import { PermissionsGuard } from '../../../../src/common/guards/permissions.guard';
import { WorkspaceContextGuard } from '../../../../src/common/guards/workspace-context.guard';
import { GmailController } from '../../../../src/modules/gmail/gmail.controller';
import { GmailMerchantReparseService } from '../../../../src/modules/gmail/services/gmail-merchant-reparse.service';
import { ReceiptsService } from '../../../../src/modules/receipts/receipts.service';
import { GmailOAuthService } from '../../../../src/modules/gmail/services/gmail-oauth.service';
import { GmailReceiptCategoryService } from '../../../../src/modules/gmail/services/gmail-receipt-category.service';
import { GmailReceiptDuplicateService } from '../../../../src/modules/gmail/services/gmail-receipt-duplicate.service';
import { GmailReceiptExportService } from '../../../../src/modules/gmail/services/gmail-receipt-export.service';
import { GmailSyncService } from '../../../../src/modules/gmail/services/gmail-sync.service';
import { GmailWatchService } from '../../../../src/modules/gmail/services/gmail-watch.service';
import { GmailService } from '../../../../src/modules/gmail/services/gmail.service';
import { workspaceCurrencyProvider } from '../../../helpers/workspace-currency-stub';

describe('GmailController - Receipt Thumbnail Endpoint', () => {
  let controller: GmailController;
  let receiptRepository: { findOne: jest.Mock };

  const workspaceId = 'ws-123';

  const createMockResponse = () => {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GmailController],
      providers: [
        workspaceCurrencyProvider(),
        {
          provide: getRepositoryToken(Receipt),
          useValue: {
            findOne: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Transaction), useValue: {} },
        { provide: getRepositoryToken(GmailSettings), useValue: {} },
        { provide: getRepositoryToken(Category), useValue: {} },
        { provide: GmailOAuthService, useValue: {} },
        { provide: GmailService, useValue: {} },
        { provide: GmailWatchService, useValue: {} },
        { provide: GmailSyncService, useValue: {} },
        { provide: GmailReceiptDuplicateService, useValue: {} },
        { provide: GmailReceiptCategoryService, useValue: {} },
        { provide: GmailReceiptExportService, useValue: {} },
        { provide: GmailMerchantReparseService, useValue: {} },
        { provide: ReceiptsService, useValue: {} },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    })
      .overrideGuard(WorkspaceContextGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionsGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<GmailController>(GmailController);
    receiptRepository = module.get(getRepositoryToken(Receipt));
  });

  it('returns 404 when receipt is not found', async () => {
    receiptRepository.findOne.mockResolvedValue(null);
    const res = createMockResponse();

    await (controller as any).getReceiptThumbnail(
      workspaceId,
      'missing-receipt',
      undefined,
      res,
    );

    expect(receiptRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'missing-receipt', workspaceId: 'ws-123' },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Receipt not found' });
  });

  it('returns 404 when receipt has no PDF attachment path', async () => {
    receiptRepository.findOne.mockResolvedValue({
      id: 'receipt-1',
      userId: 'user-123',
      attachmentPaths: ['/tmp/not-a-pdf.txt'],
      metadata: { attachments: [{ filename: 'not-a-pdf.txt', mimeType: 'text/plain', size: 1, id: 'att-1' }] },
    } as Receipt);
    const accessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    const res = createMockResponse();

    await (controller as any).getReceiptThumbnail(workspaceId, 'receipt-1', undefined, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'No PDF attachment found' });

    accessSpy.mockRestore();
  });

  it('returns 404 from file endpoint when receipt is not found', async () => {
    receiptRepository.findOne.mockResolvedValue(null);
    const res = createMockResponse();

    await (controller as any).getReceiptFile(workspaceId, 'missing-receipt', res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Receipt not found' });
  });

  it('returns 503 from file endpoint when attachment path is unavailable', async () => {
    receiptRepository.findOne.mockResolvedValue({
      id: 'receipt-1',
      userId: 'user-123',
      attachmentPaths: ['/tmp/not-a-pdf.txt'],
      metadata: { attachments: [{ filename: 'not-a-pdf.txt', mimeType: 'text/plain', size: 1, id: 'att-1' }] },
    } as Receipt);
    const accessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    const readFileSpy = jest.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('read failed'));
    const res = createMockResponse();

    await (controller as any).getReceiptFile(workspaceId, 'receipt-1', res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'RECEIPT_FILE_UNAVAILABLE',
        message: 'Failed to load receipt file',
      },
    });

    accessSpy.mockRestore();
    readFileSpy.mockRestore();
  });

  it('serves image attachments from file endpoint for scanned receipts', async () => {
    receiptRepository.findOne.mockResolvedValue({
      id: 'receipt-image-1',
      userId: 'user-123',
      attachmentPaths: ['/tmp/receipt.jpg'],
      metadata: {
        attachments: [
          {
            filename: 'receipt.jpg',
            mimeType: 'image/jpeg',
            size: 5,
            id: 'att-1',
          },
        ],
      },
    } as Receipt);
    const accessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    const readFileSpy = jest.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('image'));
    const res = createMockResponse();

    await (controller as any).getReceiptFile(workspaceId, 'receipt-image-1', res);

    expect(res.status).not.toHaveBeenCalledWith(404);
    expect(res.json).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'inline; filename="receipt.jpg"',
    );
    expect(res.send).toHaveBeenCalledWith(Buffer.from('image'));

    accessSpy.mockRestore();
    readFileSpy.mockRestore();
  });

  it('serves image attachments from thumbnail endpoint for scanned receipts', async () => {
    receiptRepository.findOne.mockResolvedValue({
      id: 'receipt-thumb-1',
      userId: 'user-123',
      attachmentPaths: ['/tmp/receipt-thumb.jpg'],
      metadata: {
        attachments: [
          {
            filename: 'receipt-thumb.jpg',
            mimeType: 'image/jpeg',
            size: 5,
            id: 'att-thumb-1',
          },
        ],
      },
    } as Receipt);
    const accessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
    const readFileSpy = jest
      .spyOn(fs.promises, 'readFile')
      .mockResolvedValue(Buffer.from('thumbnail-image'));
    const res = createMockResponse();

    await (controller as any).getReceiptThumbnail(workspaceId, 'receipt-thumb-1', '240', res);

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
    expect(res.send).toHaveBeenCalledWith(Buffer.from('thumbnail-image'));

    accessSpy.mockRestore();
    readFileSpy.mockRestore();
  });
});
