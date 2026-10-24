import * as fs from 'node:fs';
import type { Receipt } from '../../../../src/entities';
import { ReceiptDocumentsService } from '../../../../src/modules/receipts/services/receipt-documents.service';

describe('ReceiptDocumentsService', () => {
  const workspaceId = 'ws-123';
  const queryBuilder = {
    where: jest.fn(),
    andWhere: jest.fn(),
    leftJoin: jest.fn(),
    leftJoinAndSelect: jest.fn(),
    orderBy: jest.fn(),
    take: jest.fn(),
    skip: jest.fn(),
    getManyAndCount: jest.fn(),
  };
  const receiptRepository = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
  };
  const categoryRepository = { find: jest.fn() };
  const cache = { get: jest.fn(), set: jest.fn() };
  let service: ReceiptDocumentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    for (const method of [
      'where',
      'andWhere',
      'leftJoin',
      'leftJoinAndSelect',
      'orderBy',
      'take',
      'skip',
    ] as const) {
      queryBuilder[method].mockReturnValue(queryBuilder);
    }
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    receiptRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    categoryRepository.find.mockResolvedValue([]);
    cache.get.mockResolvedValue(null);
    service = new ReceiptDocumentsService(
      cache as never,
      receiptRepository as never,
      categoryRepository as never,
    );
  });

  describe('list', () => {
    it('lists the receipts of the current workspace, not of the user', async () => {
      await service.list(workspaceId, {});

      expect(queryBuilder.where).toHaveBeenCalledWith('receipt.workspaceId = :workspaceId', {
        workspaceId,
      });
    });

    it('filters out failed and amountless receipts by default', async () => {
      await service.list(workspaceId, {});

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('receipt.status != :failedStatus', {
        failedStatus: 'failed',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL",
      );
    });

    it('keeps amountless scans that already have a statement when includeLinkedScans=true', async () => {
      await service.list(workspaceId, { includeLinkedScans: 'true' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "(NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL OR (receipt.source = :scanSource AND receipt.statement_id IS NOT NULL))",
        { scanSource: 'scan' },
      );
      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
        "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL",
      );
    });

    it('allows invalid receipts when includeInvalid=true', async () => {
      await service.list(workspaceId, { includeInvalid: 'true' });

      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith('receipt.status != :failedStatus', {
        failedStatus: 'failed',
      });
      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
        "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL",
      );
    });

    it('returns only receipts without amount when hasAmount=false', async () => {
      await service.list(workspaceId, { includeInvalid: 'true', hasAmount: 'false' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NULL",
      );
    });

    it('loads the receipt tags with the list', async () => {
      await service.list(workspaceId, {});

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('receipt.tags', 'tags');
    });

    it('resolves the picked category name for listed receipts', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([
        [{ id: 'receipt-1', parsedData: { categoryId: 'cat-1' } }, { id: 'receipt-2' }],
        2,
      ]);
      categoryRepository.find.mockResolvedValue([{ id: 'cat-1', name: 'Office supplies' }]);

      const result = await service.list(workspaceId, {});

      expect(result.receipts[0]).toMatchObject({
        id: 'receipt-1',
        category: { id: 'cat-1', name: 'Office supplies' },
      });
      expect(result.receipts[1]).toMatchObject({ id: 'receipt-2', category: null });
    });

    it('filters uncategorized receipts with compatible category id types', async () => {
      await service.list(workspaceId, { categoryId: 'uncategorized' });

      expect(queryBuilder.leftJoin).toHaveBeenCalledWith('receipt.transaction', 'transaction');
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        "COALESCE(NULLIF(receipt.parsed_data ->> 'categoryId', ''), transaction.category_id::text) IS NULL",
      );
    });
  });

  describe('thumbnail', () => {
    afterEach(() => jest.restoreAllMocks());

    it('reports a receipt of another workspace as not found', async () => {
      receiptRepository.findOne.mockResolvedValue(null);

      await expect(service.thumbnail('missing-receipt', workspaceId, '')).resolves.toEqual({
        kind: 'missing',
        error: 'Receipt not found',
      });
      expect(receiptRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'missing-receipt', workspaceId },
      });
    });

    it('reports a receipt without a PDF or image attachment as missing', async () => {
      receiptRepository.findOne.mockResolvedValue({
        id: 'receipt-1',
        attachmentPaths: ['receipts/not-a-pdf.txt'],
        metadata: { attachments: [{ filename: 'not-a-pdf.txt', mimeType: 'text/plain' }] },
      } as Receipt);
      jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);

      await expect(service.thumbnail('receipt-1', workspaceId, '')).resolves.toEqual({
        kind: 'missing',
        error: 'No PDF attachment found',
      });
    });

    it('reports an attachment gone from disk as missing', async () => {
      receiptRepository.findOne.mockResolvedValue({
        id: 'receipt-1',
        attachmentPaths: ['receipts/gone.pdf'],
        metadata: {},
      } as Receipt);
      jest.spyOn(fs.promises, 'access').mockRejectedValue(new Error('ENOENT'));

      await expect(service.thumbnail('receipt-1', workspaceId, '')).resolves.toEqual({
        kind: 'missing',
        error: 'No attachment found',
      });
    });

    it('never reads a stored path outside the uploads directory', async () => {
      receiptRepository.findOne.mockResolvedValue({
        id: 'receipt-1',
        attachmentPaths: ['/etc/passwd'],
        metadata: {},
      } as Receipt);
      const accessSpy = jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      const readFileSpy = jest.spyOn(fs.promises, 'readFile');

      await expect(service.thumbnail('receipt-1', workspaceId, '')).resolves.toEqual({
        kind: 'missing',
        error: 'No attachment found',
      });
      expect(accessSpy).not.toHaveBeenCalled();
      expect(readFileSpy).not.toHaveBeenCalled();
    });

    it('serves an image attachment as its own thumbnail', async () => {
      receiptRepository.findOne.mockResolvedValue({
        id: 'receipt-thumb-1',
        attachmentPaths: ['receipts/receipt-thumb.jpg'],
        metadata: { attachments: [{ filename: 'receipt-thumb.jpg', mimeType: 'image/jpeg' }] },
      } as Receipt);
      jest.spyOn(fs.promises, 'access').mockResolvedValue(undefined);
      jest.spyOn(fs.promises, 'readFile').mockResolvedValue(Buffer.from('thumbnail-image'));

      await expect(service.thumbnail('receipt-thumb-1', workspaceId, '240')).resolves.toEqual({
        kind: 'image',
        mimeType: 'image/jpeg',
        data: Buffer.from('thumbnail-image'),
      });
    });
  });
});
