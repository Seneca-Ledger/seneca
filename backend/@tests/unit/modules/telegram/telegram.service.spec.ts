import { InsightCategory, InsightSeverity, InsightType } from '@/entities/insight.entity';
import { ReportStatus } from '@/entities/telegram-report.entity';
import type { User } from '@/entities/user.entity';
import { TelegramService } from '@/modules/telegram/telegram.service';
import { APP_NAME } from '../../../../src/common/brand';

function createConfigMock() {
  return { get: jest.fn().mockReturnValue('test-bot-token') } as any;
}

function createUserRepoMock(users: Partial<User>[] = []) {
  const queryBuilder: any = {
    where: jest.fn(() => queryBuilder),
    andWhere: jest.fn(() => queryBuilder),
    getOne: jest.fn(async () => users[0] ?? null),
  };
  return {
    merge: jest.fn((user: any, patch: any) => ({ ...user, ...patch })),
    save: jest.fn(async (user: any) => user),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => queryBuilder),
    findOne: jest.fn(async () => null),
  } as any;
}

function createReportRepoMock() {
  return {
    findAndCount: jest.fn(async () => [[], 0]),
    create: jest.fn((data: any) => ({ ...data, status: ReportStatus.PENDING })),
    save: jest.fn(async (data: any) => data),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(async () => null),
    })),
  } as any;
}

function createGoalsServiceMock(goals: unknown[] = []) {
  return { findAll: jest.fn(async () => goals) } as any;
}

function createNetWorthServiceMock(netWorth: unknown) {
  return { getNetWorth: jest.fn(async () => netWorth) } as any;
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    workspaceId: 'workspace-1',
    telegramId: 'tg-1',
    telegramChatId: 'chat-1',
    locale: 'ru',
    ...overrides,
  } as User;
}

function baseNetWorth(overrides: Record<string, unknown> = {}) {
  return {
    range: '30d',
    currency: 'KZT',
    current: 1000,
    previous: 900,
    change: 100,
    changePercent: 11.11,
    assetsTotal: 1000,
    liabilitiesTotal: 0,
    series: [],
    breakdown: [],
    byRisk: [],
    byRole: [],
    riskyPercent: 0,
    assetLines: [],
    ...overrides,
  };
}

function createService(options: {
  users?: Partial<User>[];
  goals?: unknown[];
  netWorth?: unknown;
  /** Whether the user is still a member of the workspace the bot serves. */
  member?: boolean;
  /** What a Connect link code resolves to; null for an unknown or used code. */
  linkClaim?: { userId: string; workspaceId: string; botId: string } | null;
  /** The bot token saved in the settings of the workspace the chat is connected in. */
  workspaceBotToken?: string;
} = {}) {
  const userRepository = createUserRepoMock(options.users ?? []);
  const telegramReportRepository = createReportRepoMock();
  const goalsService = createGoalsServiceMock(options.goals);
  const netWorthService = createNetWorthServiceMock(options.netWorth ?? baseNetWorth());
  const reportsService = {
    generateDailyReport: jest.fn(),
    generateMonthlyReport: jest.fn(),
  } as any;
  const statementsService = { create: jest.fn() } as any;
  const workspaceMemberRepository = {
    findOne: jest.fn(async () => (options.member === false ? null : { role: 'owner' })),
  } as any;

  const applicationSettingsService = {
    getTelegramSettings: jest.fn(async () => ({ botToken: options.workspaceBotToken ?? null })),
  } as any;
  const linkCodes = { take: jest.fn(async () => options.linkClaim ?? null) } as any;

  const service = new TelegramService(
    createConfigMock(),
    userRepository,
    telegramReportRepository,
    reportsService,
    statementsService,
    goalsService,
    netWorthService,
    workspaceMemberRepository,
    applicationSettingsService,
    undefined,
    undefined,
    undefined,
    undefined,
    linkCodes,
  );

  return {
    service,
    userRepository,
    telegramReportRepository,
    goalsService,
    netWorthService,
    reportsService,
    workspaceMemberRepository,
    applicationSettingsService,
    linkCodes,
  };
}

/** Captures every `sendMessage` payload the service posts to Telegram. */
function mockFetchOk() {
  const calls: Array<{ chat_id: string; text: string; url: string }> = [];
  global.fetch = jest.fn(async (url: unknown, init: any) => {
    calls.push({ ...JSON.parse(init.body), url: String(url) });
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 1 } }),
    };
  }) as any;
  return calls;
}

describe('TelegramService locale resolution', () => {
  it('tells a known user with /start that the chat is connected, in their stored locale', async () => {
    const calls = mockFetchOk();
    const { service } = createService({ users: [user({ locale: 'es', telegramId: 'tg-9' })] });

    await service.handleUpdate({
      message: {
        chat: { id: 'chat-1' },
        text: '/start',
        from: { id: 'tg-9', language_code: 'de' },
      },
    });

    expect(calls[0].text).toContain('Telegram conectado');
  });

  it('falls back to Telegram’s client language for an unmatched /start', async () => {
    const calls = mockFetchOk();
    const { service } = createService({ users: [] });

    await service.handleUpdate({
      message: {
        chat: { id: 'chat-1' },
        text: '/start',
        from: { id: 'tg-unknown', language_code: 'de' },
      },
    });

    expect(calls[0].text).toContain('Hallo!');
  });

  it('falls back to English when Telegram reports an unsupported client language', async () => {
    const calls = mockFetchOk();
    const { service } = createService({ users: [] });

    await service.handleUpdate({
      message: {
        chat: { id: 'chat-1' },
        text: '/start',
        from: { id: 'tg-unknown', language_code: 'xx' },
      },
    });

    expect(calls[0].text).toContain('Hi!');
  });

  it('renders /help and the unknown-command reply in the resolved locale', async () => {
    const calls = mockFetchOk();
    const { service } = createService({ users: [user({ locale: 'en', telegramId: 'tg-9' })] });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/help', from: { id: 'tg-9' } },
    });
    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/nonsense', from: { id: 'tg-9' } },
    });

    expect(calls[0].text).toContain('/goals — progress on your savings goals');
    expect(calls[1].text).toBe('Unknown command. Use /help to see the list of commands.');
  });
});

describe('TelegramService /goals', () => {
  it('reports an empty state when the workspace has no goals', async () => {
    const calls = mockFetchOk();
    const { service } = createService({ users: [user({ locale: 'en', telegramId: 'tg-9' })], goals: [] });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/goals', from: { id: 'tg-9' } },
    });

    expect(calls[0].text).toBe(`No goals yet. Create one in the ${APP_NAME} web app.`);
  });

  it('lists each goal with its progress', async () => {
    const calls = mockFetchOk();
    const { service } = createService({
      users: [user({ locale: 'en', telegramId: 'tg-9' })],
      goals: [
        { name: 'Emergency fund', currentAmount: 5000, targetAmount: 10000, currency: 'KZT', percent: 50 },
      ],
    });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/goals', from: { id: 'tg-9' } },
    });

    expect(calls[0].text).toContain('Savings goals');
    expect(calls[0].text).toContain('Emergency fund: 5,000.00 / 10,000.00 KZT (50%)');
  });

  it('tells an unconnected chat to link their account first', async () => {
    const calls = mockFetchOk();
    const { service } = createService({ users: [] });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/goals', from: { id: 'tg-unknown', language_code: 'en' } },
    });

    expect(calls[0].text).toContain(`This chat isn't connected to a ${APP_NAME} account yet`);
  });
});

describe('TelegramService /networth', () => {
  it('shows an upward change', async () => {
    const calls = mockFetchOk();
    const { service } = createService({
      users: [user({ locale: 'en', telegramId: 'tg-9' })],
      netWorth: baseNetWorth({ current: 1100, change: 100, changePercent: 10 }),
    });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/networth', from: { id: 'tg-9' } },
    });

    expect(calls[0].text).toContain('Net worth: 1,100.00 KZT');
    expect(calls[0].text).toContain('▲ +100.00 KZT (+10%) over the period');
  });

  it('shows a downward change', async () => {
    const calls = mockFetchOk();
    const { service } = createService({
      users: [user({ locale: 'en', telegramId: 'tg-9' })],
      netWorth: baseNetWorth({ current: 800, change: -100, changePercent: -11.11 }),
    });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/networth', from: { id: 'tg-9' } },
    });

    // The ▼ marker already conveys direction, so the percent alongside it is
    // shown as a magnitude, not doubled up with its own minus sign.
    expect(calls[0].text).toContain('▼ 100.00 KZT (11.11%) over the period');
  });

  it('omits the percentage line when there was nothing to compare against', async () => {
    const calls = mockFetchOk();
    const { service } = createService({
      users: [user({ locale: 'en', telegramId: 'tg-9' })],
      netWorth: baseNetWorth({ previous: 0, change: 500, changePercent: null }),
    });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/networth', from: { id: 'tg-9' } },
    });

    expect(calls[0].text).toContain('Change over the period: 500.00 KZT');
  });

  it('appends the 80/20 risk warning past the threshold', async () => {
    const calls = mockFetchOk();
    const { service } = createService({
      users: [user({ locale: 'en', telegramId: 'tg-9' })],
      netWorth: baseNetWorth({ riskyPercent: 35 }),
    });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/networth', from: { id: 'tg-9' } },
    });

    expect(calls[0].text).toContain('35% of assets are at medium/high risk — above the 20% threshold');
  });

  it('stays quiet about risk when the allocation is within the rule', async () => {
    const calls = mockFetchOk();
    const { service } = createService({
      users: [user({ locale: 'en', telegramId: 'tg-9' })],
      netWorth: baseNetWorth({ riskyPercent: 10 }),
    });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/networth', from: { id: 'tg-9' } },
    });

    expect(calls[0].text).not.toContain('medium/high risk');
  });
});

describe('TelegramService.pushInsightDigest', () => {
  it('sends one message per insight, prefixed with the digest header', async () => {
    const calls = mockFetchOk();
    const { service } = createService();

    await service.pushInsightDigest(user({ locale: 'en' }), [
      {
        type: InsightType.RISKY_ALLOCATION,
        category: InsightCategory.PATTERN,
        severity: InsightSeverity.WARN,
        title: 'Too much capital at risk',
        message: '35% of assets sit in medium or high risk — above the 20% limit',
      } as any,
    ]);

    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain(`New ${APP_NAME} alert`);
    expect(calls[0].text).toContain('Too much capital at risk');
  });

  it('does nothing when the recipient has no connected chat', async () => {
    const calls = mockFetchOk();
    const { service } = createService();

    await service.pushInsightDigest(user({ telegramChatId: undefined as unknown as string }), [
      { title: 'x', message: 'y', severity: InsightSeverity.WARN } as any,
    ]);

    expect(calls).toHaveLength(0);
  });
});

describe('TelegramService workspace', () => {
  it('answers for the linked workspace, not the one the user registered with', async () => {
    mockFetchOk();
    const { service, goalsService } = createService({
      users: [user({ locale: 'en', telegramId: 'tg-9', telegramWorkspaceId: 'ws-open' })],
    });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/goals', from: { id: 'tg-9' } },
    });

    expect(goalsService.findAll).toHaveBeenCalledWith('ws-open');
  });

  it('treats a chat whose user left that workspace as not connected', async () => {
    const calls = mockFetchOk();
    const { service, goalsService } = createService({
      users: [user({ locale: 'en', telegramId: 'tg-9', telegramWorkspaceId: 'ws-left' })],
      member: false,
    });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, text: '/goals', from: { id: 'tg-9' } },
    });

    expect(goalsService.findAll).not.toHaveBeenCalled();
    expect(calls[0].text).toContain(`This chat isn't connected to a ${APP_NAME} account yet`);
  });

  it('builds reports for the workspace, not for the user id', async () => {
    mockFetchOk();
    const { service, reportsService } = createService();
    reportsService.generateDailyReport.mockResolvedValue({
      date: '2026-09-01',
      income: { totalAmount: 0, transactionCount: 0, topCounterparties: [] },
      expense: { totalAmount: 0, transactionCount: 0, topCategories: [] },
      summary: { startBalance: 0, endBalance: 0, difference: 0 },
    });

    await service
      .sendReport(user(), { reportType: 'daily' as any, date: '2026-09-01' }, 'ws-open')
      .catch(() => undefined);

    expect(reportsService.generateDailyReport).toHaveBeenCalledWith('ws-open', '2026-09-01');
  });
});

describe('TelegramService Connect link', () => {
  const claim = { userId: 'user-1', workspaceId: 'ws-open', botId: '123' };
  const start = (code: string, languageCode = 'en') => ({
    message: { chat: { id: 555 }, text: `/start ${code}`, from: { id: 777, language_code: languageCode } },
  });

  it('binds the chat to the account and workspace the code was issued for', async () => {
    const calls = mockFetchOk();
    const { service, userRepository, linkCodes } = createService({ linkClaim: claim });
    userRepository.findOne.mockResolvedValue(user({ locale: 'en', telegramId: null, telegramChatId: null }));

    await service.handleUpdate(start('code-1'), '123:secret');

    expect(linkCodes.take).toHaveBeenCalledWith('code-1');
    expect(userRepository.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { telegramId: '777', telegramChatId: '555', telegramWorkspaceId: 'ws-open' },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain('Telegram connected');
    // The reply goes out through the bot the code came in on.
    expect(calls[0].url).toContain('/bot123:secret/sendMessage');
  });

  it('takes the chat away from any account it was connected to before', async () => {
    mockFetchOk();
    const { service, userRepository } = createService({ linkClaim: claim });
    userRepository.findOne.mockResolvedValue(user());

    await service.handleUpdate(start('code-1'), '123:secret');

    const released = { telegramId: null, telegramChatId: null, telegramWorkspaceId: null };
    expect(userRepository.update).toHaveBeenCalledWith({ telegramId: '777' }, released);
    expect(userRepository.update).toHaveBeenCalledWith({ telegramChatId: '555' }, released);
  });

  it('refuses an unknown, expired or used code', async () => {
    const calls = mockFetchOk();
    const { service, userRepository } = createService({ linkClaim: null });

    await service.handleUpdate(start('code-1', 'de'), '123:secret');

    expect(userRepository.update).not.toHaveBeenCalled();
    expect(calls[0].text).toContain('abgelaufen');
  });

  it('refuses a code issued for another bot', async () => {
    const calls = mockFetchOk();
    const { service, userRepository } = createService({ linkClaim: { ...claim, botId: '999' } });
    userRepository.findOne.mockResolvedValue(user());

    await service.handleUpdate(start('code-1'), '123:secret');

    expect(userRepository.update).not.toHaveBeenCalled();
    expect(calls[0].text).toContain('This link has expired');
  });

  it('refuses a code once its user has left the workspace', async () => {
    const calls = mockFetchOk();
    const { service, userRepository } = createService({ linkClaim: claim, member: false });
    userRepository.findOne.mockResolvedValue(user());

    await service.handleUpdate(start('code-1'), '123:secret');

    expect(userRepository.update).not.toHaveBeenCalled();
    expect(calls[0].text).toContain('This link has expired');
  });
});

describe('TelegramService bot choice', () => {
  it('writes to a connected chat through the bot of the workspace it was connected in', async () => {
    const calls = mockFetchOk();
    const { service, applicationSettingsService } = createService({ workspaceBotToken: '456:ws' });
    const connected = user({ telegramWorkspaceId: 'ws-open' });

    await service.pushInsightDigest(connected, [{ title: 't', message: 'm' } as any]);

    expect(applicationSettingsService.getTelegramSettings).toHaveBeenCalledWith(connected, 'ws-open');
    expect(calls[0].url).toContain('/bot456:ws/sendMessage');
  });

  it('falls back to the server bot when the workspace has none of its own', async () => {
    const calls = mockFetchOk();
    const { service } = createService();

    await service.pushInsightDigest(user(), [{ title: 't', message: 'm' } as any]);

    expect(calls[0].url).toContain('/bottest-bot-token/sendMessage');
  });
});

describe('TelegramService inbound bot', () => {
  const goals = { message: { chat: { id: 'chat-1' }, text: '/goals', from: { id: 'tg-9' } } };

  it('answers a chat only on the bot of the workspace it was connected in', async () => {
    const calls = mockFetchOk();
    const { service, goalsService } = createService({
      users: [user({ locale: 'en', telegramId: 'tg-9', telegramWorkspaceId: 'ws-open' })],
      workspaceBotToken: '456:ws',
    });

    // Another workspace's bot, whose token its admin knows: every field of the update is theirs.
    await service.handleUpdate(goals, '999:attacker');
    expect(goalsService.findAll).not.toHaveBeenCalled();
    expect(calls[0].text).toContain(`This chat isn't connected to a ${APP_NAME} account yet`);
    expect(calls[0].url).toContain('/bot999:attacker/sendMessage');

    await service.handleUpdate(goals, '456:ws');
    expect(goalsService.findAll).toHaveBeenCalledWith('ws-open');
  });

  it('serves a workspace without its own bot only through the shared bot', async () => {
    mockFetchOk();
    const { service, goalsService } = createService({
      users: [user({ locale: 'en', telegramId: 'tg-9', telegramWorkspaceId: 'ws-open' })],
    });

    await service.handleUpdate(goals, '999:attacker');
    expect(goalsService.findAll).not.toHaveBeenCalled();

    await service.handleUpdate(goals);
    expect(goalsService.findAll).toHaveBeenCalledWith('ws-open');
  });

  it('finds the account by the chat, and by the sender only for a chat never recorded', async () => {
    mockFetchOk();
    const { service, userRepository } = createService({ users: [user({ locale: 'en' })] });
    const queryBuilder = userRepository.createQueryBuilder();
    userRepository.createQueryBuilder.mockClear();
    queryBuilder.andWhere.mockClear();
    queryBuilder.getOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await service.handleUpdate(goals);

    expect(queryBuilder.andWhere.mock.calls).toEqual(
      expect.arrayContaining([
        ['user.telegramChatId = :chatId', { chatId: 'chat-1' }],
        ['user.telegramId = :telegramId', { telegramId: 'tg-9' }],
        ['user.telegramChatId IS NULL'],
      ]),
    );
    expect(queryBuilder.andWhere.mock.calls).not.toContainEqual([
      expect.stringContaining(' OR '),
      expect.anything(),
    ]);
  });
});

describe('TelegramService send-report', () => {
  it('refuses to send to a chat other than the caller’s own', async () => {
    const calls = mockFetchOk();
    const { service, reportsService } = createService();

    await expect(
      service.sendReport(user(), { reportType: 'daily' as any, chatId: 'someone-else' }, 'ws-open'),
    ).rejects.toThrow('chatId must be your connected Telegram chat');
    expect(reportsService.generateDailyReport).not.toHaveBeenCalled();
    expect(calls).toHaveLength(0);
  });
});

describe('TelegramService connection', () => {
  it('reports whether the bot answers for the workspace being viewed', () => {
    const { service } = createService();
    const connected = user({ telegramWorkspaceId: 'ws-open' });

    expect(service.getConnection(connected, 'ws-open')).toEqual({ connected: true, inThisWorkspace: true });
    expect(service.getConnection(connected, 'ws-other')).toEqual({ connected: true, inThisWorkspace: false });
    expect(service.getConnection(user({ telegramChatId: null }), 'ws-open')).toEqual({
      connected: false,
      inThisWorkspace: false,
    });
  });

  it('counts a chat connected before the workspace was recorded as the registration workspace', () => {
    const { service } = createService();

    expect(service.getConnection(user({ telegramWorkspaceId: null }), 'workspace-1')).toEqual({
      connected: true,
      inThisWorkspace: true,
    });
  });

  it('forgets the chat on disconnect', async () => {
    const { service, userRepository } = createService();

    await service.disconnect(user());

    expect(userRepository.update).toHaveBeenCalledWith(
      { id: 'user-1' },
      { telegramId: null, telegramChatId: null, telegramWorkspaceId: null },
    );
  });
});
