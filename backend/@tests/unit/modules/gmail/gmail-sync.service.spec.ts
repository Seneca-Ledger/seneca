import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  GmailSettings,
  Integration,
  IntegrationProvider,
  IntegrationStatus,
  Receipt,
  ReceiptProcessingJob,
  WorkspaceKind,
} from '../../../../src/entities';
import { GmailSyncService } from '../../../../src/modules/gmail/services/gmail-sync.service';
import { GmailService } from '../../../../src/modules/gmail/services/gmail.service';
import { APP_NAME } from '../../../../src/common/brand';

describe('GmailSyncService', () => {
  let service: GmailSyncService;
  let integrationRepo: jest.Mocked<Repository<Integration>>;
  let gmailSettingsRepo: jest.Mocked<Repository<GmailSettings>>;
  let receiptRepo: jest.Mocked<Repository<Receipt>>;
  let jobRepo: jest.Mocked<Repository<ReceiptProcessingJob>>;
  let gmailService: jest.Mocked<GmailService>;

  const mockIntegration: Partial<Integration> = {
    id: 'int-123',
    provider: IntegrationProvider.GMAIL,
    status: IntegrationStatus.CONNECTED,
    connectedByUserId: 'user-123',
    workspaceId: 'ws-123',
    gmailSettings: {
      id: 'settings-123',
      integrationId: 'int-123',
      labelId: 'Label_123',
      labelName: `${APP_NAME}/Receipts`,
      filterEnabled: true,
      filterConfig: {
        hasAttachment: true,
        keywords: ['receipt', 'invoice'],
      },
      lastSyncAt: new Date('2026-02-05T00:00:00Z'),
      watchEnabled: true,
      watchExpiration: null,
      historyId: 'hist-123',
    } as GmailSettings,
  };

  const mockMessages = [
    { id: 'msg-1', threadId: 'thread-1' },
    { id: 'msg-2', threadId: 'thread-2' },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailSyncService,
        {
          provide: getRepositoryToken(Integration),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(GmailSettings),
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Receipt),
          useValue: {
            findOne: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(ReceiptProcessingJob),
          useValue: {
            create: jest.fn().mockImplementation(dto => dto),
            save: jest
              .fn()
              .mockImplementation(entity => Promise.resolve({ id: 'job-1', ...entity })),
          },
        },
        {
          provide: GmailService,
          useValue: {
            listMessages: jest.fn(),
            setupGmailEnvironment: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<GmailSyncService>(GmailSyncService);
    integrationRepo = module.get(getRepositoryToken(Integration));
    gmailSettingsRepo = module.get(getRepositoryToken(GmailSettings));
    receiptRepo = module.get(getRepositoryToken(Receipt));
    jobRepo = module.get(getRepositoryToken(ReceiptProcessingJob));
    gmailService = module.get(GmailService);

    receiptRepo.count.mockResolvedValue(1);
  });

  describe('syncAllIntegrations', () => {
    it('should sync all connected Gmail integrations', async () => {
      integrationRepo.find.mockResolvedValue([mockIntegration as Integration]);
      gmailService.listMessages.mockResolvedValue(mockMessages);
      receiptRepo.findOne.mockResolvedValue(null);

      const result = await service.syncAllIntegrations();

      expect(integrationRepo.find).toHaveBeenCalledWith({
        where: {
          provider: IntegrationProvider.GMAIL,
          status: IntegrationStatus.CONNECTED,
          workspace: { kind: WorkspaceKind.STANDARD },
        },
        relations: ['gmailSettings'],
      });
      expect(result.synced).toBe(1);
      expect(result.messagesFound).toBe(2);
      expect(result.jobsCreated).toBe(2);
    });

    it('should skip integrations without connectedByUserId', async () => {
      const integrationWithoutUser = { ...mockIntegration, connectedByUserId: null };
      integrationRepo.find.mockResolvedValue([integrationWithoutUser as Integration]);

      const result = await service.syncAllIntegrations();

      expect(result.synced).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });

  describe('syncForWorkspace', () => {
    it('should create processing jobs for new messages', async () => {
      integrationRepo.findOne.mockResolvedValue(mockIntegration as Integration);
      gmailService.listMessages.mockResolvedValue(mockMessages);
      receiptRepo.findOne.mockResolvedValue(null);

      const result = await service.syncForWorkspace('ws-123');

      expect(integrationRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ workspaceId: 'ws-123' }),
        }),
      );
      // Deduplicated within the workspace: another workspace may hold the same message.
      expect(receiptRepo.findOne).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-123', gmailMessageId: mockMessages[0].id },
      });
      expect(jobRepo.create).toHaveBeenCalledTimes(2);
      expect(jobRepo.save).toHaveBeenCalledTimes(2);
      expect(result.messagesFound).toBe(2);
      expect(result.jobsCreated).toBe(2);
      expect(gmailSettingsRepo.save).toHaveBeenCalledTimes(1);
    });

    it('should skip messages that already have receipts', async () => {
      integrationRepo.findOne.mockResolvedValue(mockIntegration as Integration);
      gmailService.listMessages.mockResolvedValue(mockMessages);
      receiptRepo.findOne
        .mockResolvedValueOnce({ id: 'existing-receipt' } as Receipt)
        .mockResolvedValueOnce(null);

      const result = await service.syncForWorkspace('ws-123');

      expect(result.jobsCreated).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('should build correct Gmail query from filter config', async () => {
      integrationRepo.findOne.mockResolvedValue(mockIntegration as Integration);
      gmailService.listMessages.mockResolvedValue([]);

      await service.syncForWorkspace('ws-123');

      expect(gmailService.listMessages).toHaveBeenNthCalledWith(
        1,
        'ws-123',
        expect.stringContaining('has:attachment'),
        { includeLabelFilter: true },
      );
    });

    it('should not force label or after filters on first sync', async () => {
      const firstSyncIntegration = {
        ...mockIntegration,
        gmailSettings: {
          ...mockIntegration.gmailSettings,
          lastSyncAt: null,
        } as GmailSettings,
      } as Integration;

      integrationRepo.findOne.mockResolvedValue(firstSyncIntegration);
      gmailService.listMessages.mockResolvedValue([]);

      await service.syncForWorkspace('ws-123');

      const [, query] = gmailService.listMessages.mock.calls[0];
      expect(query).not.toContain('label:');
      expect(query).not.toContain('after:');
    });

    it('should include label and after filters when lastSyncAt exists', async () => {
      integrationRepo.findOne.mockResolvedValue(mockIntegration as Integration);
      receiptRepo.count.mockResolvedValue(2);
      gmailService.listMessages.mockResolvedValue([]);

      await service.syncForWorkspace('ws-123');

      const [, query, options] = gmailService.listMessages.mock.calls[0];
      expect(options).toEqual({ includeLabelFilter: true });
      expect(query).not.toContain('label:Label_123');
      expect(query).toContain('after:');
    });

    it('should ignore lastSyncAt when no receipts exist', async () => {
      const noReceiptsIntegration = {
        ...(mockIntegration as Integration),
        gmailSettings: {
          ...(mockIntegration.gmailSettings as GmailSettings),
          lastSyncAt: new Date('2026-02-05T00:00:00Z'),
        } as GmailSettings,
      } as Integration;

      integrationRepo.findOne.mockResolvedValue(noReceiptsIntegration);
      receiptRepo.count.mockResolvedValue(0);
      gmailService.listMessages.mockResolvedValue([]);

      await service.syncForWorkspace('ws-123');

      const [, query] = gmailService.listMessages.mock.calls[0];
      expect(query).not.toContain('after:');
    });
  });
});
