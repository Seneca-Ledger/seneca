import type { User } from '@/entities/user.entity';
import { TelegramService } from '@/modules/telegram/telegram.service';

/**
 * What the bot does with things that are not commands: a receipt photo, an
 * expense typed as text, and the delete button under its own replies.
 */
function createService(options: { users?: Partial<User>[] } = {}) {
  const users = options.users ?? [];
  const queryBuilder: any = {
    where: jest.fn(() => queryBuilder),
    andWhere: jest.fn(() => queryBuilder),
    getOne: jest.fn(async () => users[0] ?? null),
  };
  const userRepository = {
    merge: jest.fn((entity: any, patch: any) => ({ ...entity, ...patch })),
    save: jest.fn(async (entity: any) => entity),
    createQueryBuilder: jest.fn(() => queryBuilder),
    findOne: jest.fn(async () => null),
  } as any;
  const statementsService = {
    create: jest.fn(),
    createManualExpense: jest.fn(async () => ({ id: '11111111-1111-4111-8111-111111111111' })),
    remove: jest.fn(async () => undefined),
  } as any;
  const receiptsService = {
    createFromScan: jest.fn(async () => ({
      id: '22222222-2222-4222-8222-222222222222',
      status: 'draft',
      parsedData: { amount: 42.5, currency: 'EUR', vendor: 'REWE' },
    })),
    delete: jest.fn(async () => ({ deleted: true })),
  } as any;
  const classificationService = { ensureCategory: jest.fn(async () => 'cat-none') } as any;
  const transactionRepository = { update: jest.fn(async () => ({ affected: 1 })) } as any;
  // Behaves like the unique (key, user_id, workspace_id) constraint.
  const claimedKeys = new Set<string>();
  const idempotencyKeyRepository = {
    insert: jest.fn(async (row: any) => {
      const id = `${row.key}|${row.userId}|${row.workspaceId}`;
      if (claimedKeys.has(id)) {
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
      }
      claimedKeys.add(id);
      return { identifiers: [] };
    }),
  } as any;
  const workspaceMemberRepository = {
    findOne: jest.fn(async () => ({ role: 'owner', workspace: { currency: 'KZT' } })),
  } as any;

  const service = new TelegramService(
    { get: jest.fn().mockReturnValue('test-bot-token') } as any,
    userRepository,
    { findAndCount: jest.fn(async () => [[], 0]) } as any,
    { generateDailyReport: jest.fn(), generateMonthlyReport: jest.fn() } as any,
    statementsService,
    { findAll: jest.fn(async () => []) } as any,
    { getNetWorth: jest.fn() } as any,
    workspaceMemberRepository,
    undefined,
    receiptsService,
    classificationService,
    transactionRepository,
    idempotencyKeyRepository,
  );
  jest
    .spyOn(service as any, 'downloadTelegramFile')
    .mockResolvedValue({ originalname: 'receipt.jpg', mimetype: 'image/jpeg', path: '/tmp/r.jpg' });

  return { service, statementsService, receiptsService, transactionRepository, classificationService };
}

/** Every Telegram API call the service makes, by endpoint, with the parsed body. */
function mockFetch() {
  const calls: Array<{ url: string; body: any }> = [];
  global.fetch = jest.fn(async (url: unknown, init: any) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) };
  }) as any;
  return calls;
}

const connectedUser = {
  id: 'user-1',
  workspaceId: 'workspace-1',
  telegramId: 'tg-1',
  telegramChatId: 'chat-1',
  locale: 'en',
} as User;

describe('TelegramService inbound', () => {
  it('books a redelivered update once and replies only the first time', async () => {
    const calls = mockFetch();
    const { service, statementsService, receiptsService } = createService({
      users: [connectedUser],
    });
    const text = { update_id: 501, message: { chat: { id: 'chat-1' }, from: { id: 'tg-1' }, text: 'coffee 4.50' } };
    const photo = {
      update_id: 502,
      message: { chat: { id: 'chat-1' }, from: { id: 'tg-1' }, photo: [{ file_id: 'large' }] },
    };

    await service.handleUpdate(text);
    await service.handleUpdate(text);
    await service.handleUpdate(photo);
    await service.handleUpdate(photo);
    expect(statementsService.createManualExpense).toHaveBeenCalledTimes(1);
    expect(receiptsService.createFromScan).toHaveBeenCalledTimes(1);
    // Text: one confirmation. Photo: "reading…" and the result. Redeliveries: nothing.
    expect(calls.filter(call => call.url.endsWith('/sendMessage'))).toHaveLength(3);

    await service.handleUpdate({ ...text, update_id: 503 });
    expect(statementsService.createManualExpense).toHaveBeenCalledTimes(2);
  });

  it('turns a photo into a telegram-sourced receipt and replies with what it read', async () => {
    const calls = mockFetch();
    const { service, receiptsService } = createService({ users: [connectedUser] });

    await service.handleUpdate({
      message: {
        chat: { id: 'chat-1' },
        from: { id: 'tg-1' },
        photo: [{ file_id: 'small' }, { file_id: 'large' }],
      },
    });

    expect(receiptsService.createFromScan).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', workspaceId: 'workspace-1', source: 'telegram' }),
    );
    expect((service as any).downloadTelegramFile).toHaveBeenCalledWith(
      'large',
      expect.any(String),
      'image/jpeg',
    );
    const messages = calls.filter(call => call.url.endsWith('/sendMessage'));
    expect(messages[messages.length - 1].body.text).toContain('REWE');
    expect(messages[messages.length - 1].body.reply_markup.inline_keyboard[0][0].callback_data).toBe(
      'rcpt:del:22222222-2222-4222-8222-222222222222',
    );
  });

  it('treats an image sent as a file like a photo, a PDF like a statement', async () => {
    mockFetch();
    const { service, receiptsService, statementsService } = createService({ users: [connectedUser] });

    await service.handleUpdate({
      message: {
        chat: { id: 'chat-1' },
        from: { id: 'tg-1' },
        document: { file_id: 'img', file_name: 'scan.png', mime_type: 'image/png' },
      },
    });
    expect(receiptsService.createFromScan).toHaveBeenCalledTimes(1);

    await service.handleUpdate({
      message: {
        chat: { id: 'chat-1' },
        from: { id: 'tg-1' },
        document: { file_id: 'pdf', file_name: 'statement.pdf', mime_type: 'application/pdf' },
      },
    });
    expect(statementsService.create).toHaveBeenCalledTimes(1);
  });

  it('books "coffee 4.50" as an unreviewed manual expense in the review inbox', async () => {
    const calls = mockFetch();
    const { service, statementsService, transactionRepository } = createService({
      users: [connectedUser],
    });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, from: { id: 'tg-1' }, text: 'coffee 4.50' },
    });

    expect(statementsService.createManualExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-1',
        payload: expect.objectContaining({
          amount: '4.5',
          merchant: 'coffee',
          currency: 'KZT',
          categoryId: 'cat-none',
        }),
      }),
    );
    expect(transactionRepository.update).toHaveBeenCalledWith(
      { statementId: '11111111-1111-4111-8111-111111111111', workspaceId: 'workspace-1' },
      expect.objectContaining({ isVerified: false, categorySource: 'default' }),
    );
    const reply = calls.filter(call => call.url.endsWith('/sendMessage')).pop();
    expect(reply?.body.text).toContain('coffee');
    expect(reply?.body.reply_markup.inline_keyboard[0][0].callback_data).toBe(
      'stmt:del:11111111-1111-4111-8111-111111111111',
    );
  });

  it('explains the format when the text has no amount', async () => {
    const calls = mockFetch();
    const { service, statementsService } = createService({ users: [connectedUser] });

    await service.handleUpdate({
      message: { chat: { id: 'chat-1' }, from: { id: 'tg-1' }, text: 'hello there' },
    });

    expect(statementsService.createManualExpense).not.toHaveBeenCalled();
    expect(calls[0].body.text).toContain('4.50');
  });

  it('deletes the receipt behind the button and acknowledges the tap', async () => {
    const calls = mockFetch();
    const { service, receiptsService } = createService({ users: [connectedUser] });

    await service.handleUpdate({
      callback_query: {
        id: 'cb-1',
        from: { id: 'tg-1' },
        message: { chat: { id: 'chat-1' } },
        data: 'rcpt:del:22222222-2222-4222-8222-222222222222',
      },
    });

    expect(receiptsService.delete).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      'workspace-1',
      'user-1',
    );
    const answer = calls.find(call => call.url.endsWith('/answerCallbackQuery'));
    expect(answer?.body.callback_query_id).toBe('cb-1');
  });

  it('ignores a malformed callback without touching anything', async () => {
    const calls = mockFetch();
    const { service, receiptsService, statementsService } = createService({ users: [connectedUser] });

    await service.handleUpdate({
      callback_query: { id: 'cb-2', from: { id: 'tg-1' }, message: { chat: { id: 'chat-1' } }, data: 'stmt:del:../etc' },
    });

    expect(receiptsService.delete).not.toHaveBeenCalled();
    expect(statementsService.remove).not.toHaveBeenCalled();
    expect(calls.filter(call => call.url.endsWith('/answerCallbackQuery'))).toHaveLength(1);
  });

  describe('file transfer', () => {
    const fileService = () => {
      const { service } = createService();
      // createService stubs the download for the inbound tests; use the real one.
      (service as any).downloadTelegramFile.mockRestore();
      return service as any;
    };

    afterEach(() => jest.useRealTimers());

    it('asks Telegram for the file path again after a temporary error', async () => {
      const statuses = [502, 200];
      global.fetch = jest.fn(async () => {
        const status = statuses.shift() ?? 200;
        return new Response(JSON.stringify(status === 200 ? { ok: true, result: { file_path: 'photos/a.jpg' } } : {}), {
          status,
        });
      }) as any;

      await expect(fileService().getTelegramFilePath('file-1')).resolves.toBe('photos/a.jpg');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('gives up on a download that stalls instead of holding the update forever', async () => {
      jest.useFakeTimers();
      global.fetch = jest.fn(async (url: unknown, init: RequestInit) => {
        if (String(url).endsWith('/getFile')) {
          return new Response(JSON.stringify({ ok: true, result: { file_path: 'photos/a.jpg' } }));
        }
        return new Promise<Response>((_resolve, reject) =>
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason)),
        );
      }) as any;

      const download = fileService().downloadTelegramFile('file-1', 'a.jpg', 'image/jpeg');
      const outcome = expect(download).rejects.toThrow('Telegram file download timed out');
      await jest.advanceTimersByTimeAsync(60_000);
      await outcome;
    });
  });
});
