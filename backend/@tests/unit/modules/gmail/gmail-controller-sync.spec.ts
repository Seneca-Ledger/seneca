import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, TestingModule } from '@nestjs/testing';
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

describe('GmailController - Sync Endpoint', () => {
  let controller: GmailController;
  let gmailSyncService: jest.Mocked<GmailSyncService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GmailController],
      providers: [
        workspaceCurrencyProvider(),
        {
          provide: GmailSyncService,
          useValue: {
            syncForWorkspace: jest.fn().mockResolvedValue({
              messagesFound: 5,
              jobsCreated: 3,
              skipped: 2,
              errors: [],
              warnings: [],
            }),
          },
        },
        { provide: getRepositoryToken(Receipt), useValue: {} },
        { provide: getRepositoryToken(Transaction), useValue: {} },
        { provide: getRepositoryToken(GmailSettings), useValue: {} },
        { provide: getRepositoryToken(Category), useValue: {} },
        { provide: GmailOAuthService, useValue: {} },
        { provide: GmailService, useValue: {} },
        { provide: GmailWatchService, useValue: {} },
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
    gmailSyncService = module.get(GmailSyncService);
  });

  describe('POST /integrations/gmail/sync', () => {
    it('should trigger manual sync and return results', async () => {
      const result = await controller.triggerSync('ws-123');

      expect(gmailSyncService.syncForWorkspace).toHaveBeenCalledWith('ws-123');
      expect(result).toEqual({
        success: true,
        messagesFound: 5,
        jobsCreated: 3,
        skipped: 2,
        errors: [],
        warnings: [],
      });
    });

    it('should handle sync errors', async () => {
      gmailSyncService.syncForWorkspace.mockRejectedValue(new Error('Gmail API error'));

      await expect(controller.triggerSync('ws-123')).rejects.toThrow();
    });
  });
});
