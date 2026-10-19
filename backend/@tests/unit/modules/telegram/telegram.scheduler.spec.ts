import { InsightSeverity } from '@/entities/insight.entity';
import { TelegramScheduler } from '@/modules/telegram/telegram.scheduler';

function createUserRepoMock(users: unknown[]) {
  return { find: jest.fn(async () => users) } as any;
}

describe('TelegramScheduler.pushInsightDigests', () => {
  it('pushes only the newly-created warn/critical insights, per connected user', async () => {
    const telegramService = {
      pushInsightDigest: jest.fn(async () => undefined),
      resolveWorkspaceId: jest.fn(async (u: any) => u.telegramWorkspaceId ?? u.workspaceId ?? null),
    } as any;
    const insightsService = {
      refresh: jest.fn(async () => ({
        created: 2,
        updated: 1,
        total: 3,
        newInsights: [
          { id: 'i-1', severity: InsightSeverity.WARN },
          { id: 'i-2', severity: InsightSeverity.INFO },
        ],
      })),
    } as any;
    const userRepository = createUserRepoMock([
      { id: 'user-1', workspaceId: 'workspace-1', telegramChatId: 'chat-1' },
    ]);
    const auditService = { createEvent: jest.fn() } as any;

    const scheduler = new TelegramScheduler(
      telegramService,
      insightsService,
      userRepository,
      auditService,
    );

    await scheduler.pushInsightDigests();

    expect(insightsService.refresh).toHaveBeenCalledWith('user-1', 'workspace-1');
    expect(telegramService.pushInsightDigest).toHaveBeenCalledTimes(1);
    const [, pushedInsights] = telegramService.pushInsightDigest.mock.calls[0];
    expect(pushedInsights).toEqual([{ id: 'i-1', severity: InsightSeverity.WARN }]);
  });

  it('skips users with no workspace, since insights are workspace-scoped', async () => {
    const telegramService = {
      pushInsightDigest: jest.fn(async () => undefined),
      resolveWorkspaceId: jest.fn(async (u: any) => u.telegramWorkspaceId ?? u.workspaceId ?? null),
    } as any;
    const insightsService = { refresh: jest.fn() } as any;
    const userRepository = createUserRepoMock([
      { id: 'user-1', workspaceId: null, telegramChatId: 'chat-1' },
    ]);

    const scheduler = new TelegramScheduler(
      telegramService,
      insightsService,
      userRepository,
      { createEvent: jest.fn() } as any,
    );

    await scheduler.pushInsightDigests();

    expect(insightsService.refresh).not.toHaveBeenCalled();
  });

  it('stays quiet when nothing new crossed the warn/critical bar', async () => {
    const telegramService = {
      pushInsightDigest: jest.fn(async () => undefined),
      resolveWorkspaceId: jest.fn(async (u: any) => u.telegramWorkspaceId ?? u.workspaceId ?? null),
    } as any;
    const insightsService = {
      refresh: jest.fn(async () => ({
        created: 1,
        updated: 0,
        total: 1,
        newInsights: [{ id: 'i-1', severity: InsightSeverity.INFO }],
      })),
    } as any;
    const userRepository = createUserRepoMock([
      { id: 'user-1', workspaceId: 'workspace-1', telegramChatId: 'chat-1' },
    ]);

    const scheduler = new TelegramScheduler(
      telegramService,
      insightsService,
      userRepository,
      { createEvent: jest.fn() } as any,
    );

    await scheduler.pushInsightDigests();

    expect(telegramService.pushInsightDigest).not.toHaveBeenCalled();
  });

  it('keeps checking other users after one fails', async () => {
    const telegramService = {
      pushInsightDigest: jest.fn(async () => undefined),
      resolveWorkspaceId: jest.fn(async (u: any) => u.telegramWorkspaceId ?? u.workspaceId ?? null),
    } as any;
    const insightsService = {
      refresh: jest
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({
          created: 1,
          updated: 0,
          total: 1,
          newInsights: [{ id: 'i-2', severity: InsightSeverity.CRITICAL }],
        }),
    } as any;
    const userRepository = createUserRepoMock([
      { id: 'user-1', workspaceId: 'workspace-1', telegramChatId: 'chat-1' },
      { id: 'user-2', workspaceId: 'workspace-2', telegramChatId: 'chat-2' },
    ]);

    const scheduler = new TelegramScheduler(
      telegramService,
      insightsService,
      userRepository,
      { createEvent: jest.fn() } as any,
    );

    await scheduler.pushInsightDigests();

    expect(insightsService.refresh).toHaveBeenCalledTimes(2);
    expect(telegramService.pushInsightDigest).toHaveBeenCalledTimes(1);
  });
});
