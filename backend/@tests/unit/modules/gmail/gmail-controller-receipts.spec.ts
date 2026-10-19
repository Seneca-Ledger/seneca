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

describe('GmailController - Receipts List Endpoint', () => {
  let controller: GmailController;
  const queryBuilder = {
    where: jest.fn(),
    andWhere: jest.fn(),
    leftJoin: jest.fn(),
    orderBy: jest.fn(),
    take: jest.fn(),
    skip: jest.fn(),
    getManyAndCount: jest.fn(),
  };

  const receiptRepository = {
    createQueryBuilder: jest.fn(),
  };

  const categoryRepository = {
    find: jest.fn(),
  };

  const workspaceId = 'ws-123';

  beforeEach(async () => {
    queryBuilder.where.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.leftJoin.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    queryBuilder.take.mockReturnValue(queryBuilder);
    queryBuilder.skip.mockReturnValue(queryBuilder);
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    receiptRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    categoryRepository.find.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GmailController],
      providers: [
        workspaceCurrencyProvider(),
        { provide: getRepositoryToken(Receipt), useValue: receiptRepository },
        { provide: getRepositoryToken(Transaction), useValue: {} },
        { provide: getRepositoryToken(GmailSettings), useValue: {} },
        { provide: getRepositoryToken(Category), useValue: categoryRepository },
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('lists the receipts of the current workspace, not of the user', async () => {
    await (controller as any).listReceipts(workspaceId);

    expect(queryBuilder.where).toHaveBeenCalledWith('receipt.workspaceId = :workspaceId', {
      workspaceId,
    });
  });

  it('filters out failed and amountless receipts by default', async () => {
    await (controller as any).listReceipts(workspaceId);

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('receipt.status != :failedStatus', {
      failedStatus: 'failed',
    });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL",
    );
  });

  it('keeps amountless scans that already have a statement when includeLinkedScans=true', async () => {
    await (controller as any).listReceipts(
      workspaceId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'true',
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "(NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL OR (receipt.source = :scanSource AND receipt.statement_id IS NOT NULL))",
      { scanSource: 'scan' },
    );
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL",
    );
  });

  it('allows invalid receipts when includeInvalid=true', async () => {
    await (controller as any).listReceipts(
      workspaceId,
      undefined,
      undefined,
      undefined,
      'true',
    );

    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith('receipt.status != :failedStatus', {
      failedStatus: 'failed',
    });
    expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
      "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NOT NULL",
    );
  });

  it('returns only receipts without amount when hasAmount=false', async () => {
    await (controller as any).listReceipts(
      workspaceId,
      undefined,
      undefined,
      undefined,
      'true',
      'false',
    );

    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "NULLIF(TRIM(receipt.parsed_data->>'amount'), '') IS NULL",
    );
  });

  it('resolves the picked category name for listed receipts', async () => {
    queryBuilder.getManyAndCount.mockResolvedValue([
      [{ id: 'receipt-1', parsedData: { categoryId: 'cat-1' } }, { id: 'receipt-2' }],
      2,
    ]);
    categoryRepository.find.mockResolvedValue([{ id: 'cat-1', name: 'Office supplies' }]);

    const result = await (controller as any).listReceipts(workspaceId);

    expect(result.receipts[0]).toMatchObject({
      id: 'receipt-1',
      category: { id: 'cat-1', name: 'Office supplies' },
    });
    expect(result.receipts[1]).toMatchObject({ id: 'receipt-2', category: null });
  });

  it('filters uncategorized receipts with compatible category id types', async () => {
    await (controller as any).listReceipts(
      workspaceId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      'uncategorized',
    );

    expect(queryBuilder.leftJoin).toHaveBeenCalledWith('receipt.transaction', 'transaction');
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      "COALESCE(NULLIF(receipt.parsed_data ->> 'categoryId', ''), transaction.category_id::text) IS NULL",
    );
  });
});
