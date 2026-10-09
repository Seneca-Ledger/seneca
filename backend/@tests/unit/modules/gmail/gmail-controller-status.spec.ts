import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Category,
  GmailSettings,
  IntegrationStatus,
  Receipt,
  Transaction,
} from '../../../../src/entities';
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

describe('GmailController - Status Endpoint', () => {
  let controller: GmailController;
  let gmailOAuthService: { findWorkspaceIntegration: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GmailController],
      providers: [
        workspaceCurrencyProvider(),
        {
          provide: GmailOAuthService,
          useValue: {
            findWorkspaceIntegration: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Receipt), useValue: {} },
        { provide: getRepositoryToken(Transaction), useValue: {} },
        { provide: getRepositoryToken(GmailSettings), useValue: {} },
        { provide: getRepositoryToken(Category), useValue: {} },
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
    gmailOAuthService = module.get(GmailOAuthService);
  });

  it('returns disconnected when integration status is disconnected', async () => {
    const integration = {
      id: 'integration-123',
      status: IntegrationStatus.DISCONNECTED,
      gmailSettings: null,
      scopes: ['scope-a'],
    };

    gmailOAuthService.findWorkspaceIntegration.mockResolvedValue(integration);

    await expect(controller.getStatus('ws-123')).resolves.toEqual({
      connected: false,
      status: IntegrationStatus.DISCONNECTED,
      settings: null,
      scopes: ['scope-a'],
    });
  });
});
