import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GmailWatchSubscription, Integration, WorkspaceKind } from '../../../../src/entities';
import { GmailScheduler } from '../../../../src/modules/gmail/gmail.scheduler';
import { GmailSyncService } from '../../../../src/modules/gmail/services/gmail-sync.service';
import { GmailWatchService } from '../../../../src/modules/gmail/services/gmail-watch.service';

describe('GmailScheduler', () => {
  let scheduler: GmailScheduler;
  let gmailSyncService: jest.Mocked<GmailSyncService>;
  let watchRepository: { find: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailScheduler,
        {
          provide: getRepositoryToken(GmailWatchSubscription),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Integration),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: GmailWatchService,
          useValue: {
            renewWatch: jest.fn(),
          },
        },
        {
          provide: GmailSyncService,
          useValue: {
            syncAllIntegrations: jest.fn().mockResolvedValue({
              synced: 2,
              skipped: 0,
              messagesFound: 10,
              jobsCreated: 8,
              errors: [],
            }),
          },
        },
      ],
    }).compile();

    scheduler = module.get<GmailScheduler>(GmailScheduler);
    gmailSyncService = module.get(GmailSyncService);
    watchRepository = module.get(getRepositoryToken(GmailWatchSubscription));
  });

  describe('runDailySync', () => {
    it('should call syncAllIntegrations', async () => {
      await scheduler.runDailySync();

      expect(gmailSyncService.syncAllIntegrations).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      gmailSyncService.syncAllIntegrations.mockRejectedValue(new Error('Sync failed'));

      await expect(scheduler.runDailySync()).resolves.not.toThrow();
    });
  });

  describe('renewExpiringWatches', () => {
    it('renews watches of ordinary workspaces only, never one copied into a past version', async () => {
      await scheduler.renewExpiringWatches();

      expect(watchRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            integration: { workspace: { kind: WorkspaceKind.STANDARD } },
          }),
        }),
      );
    });
  });
});
