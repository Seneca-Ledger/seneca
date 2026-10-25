import { Exit } from 'effect';
import { decodeTelegramUpdate } from '@/modules/telegram/telegram-update.schema';
import { TelegramWebhookController } from '@/modules/telegram/telegram-webhook.controller';

const decoded = (body: unknown) => {
  const exit = decodeTelegramUpdate(body);
  return Exit.isSuccess(exit) ? exit.value : 'rejected';
};

describe('decodeTelegramUpdate', () => {
  it('reads a photo message, extra fields and all', () => {
    expect(
      decoded({
        update_id: 7,
        message: {
          message_id: 1,
          date: 1760000000,
          chat: { id: 42, type: 'private' },
          from: { id: 99, language_code: 'de', is_bot: false },
          photo: [
            { file_id: 'small', width: 90, height: 90 },
            { file_id: 'large', width: 1280, height: 1280, file_size: 120000 },
          ],
        },
      }),
    ).toEqual({
      update_id: 7,
      message: {
        chat: { id: 42 },
        from: { id: 99, language_code: 'de' },
        photo: [
          { file_id: 'small', width: 90, height: 90 },
          { file_id: 'large', width: 1280, height: 1280, file_size: 120000 },
        ],
      },
    });
  });

  it('reads a document and a callback query', () => {
    expect(decoded({ message: { chat: { id: '42' }, document: { file_id: 'f', mime_type: 'application/pdf' } } }))
      .toEqual({ message: { chat: { id: '42' }, document: { file_id: 'f', mime_type: 'application/pdf' } } });
    expect(decoded({ update_id: 8, callback_query: { id: 'q', data: 'rcpt:del:1', message: { chat: { id: 1 } } } }))
      .toEqual({ update_id: 8, callback_query: { id: 'q', data: 'rcpt:del:1', message: { chat: { id: 1 } } } });
  });

  it('passes an update kind the bot does not handle as an empty update', () => {
    expect(decoded({ update_id: 9, edited_message: { text: 'changed' } })).toEqual({ update_id: 9 });
  });

  it('rejects what does not fit', () => {
    expect(decoded({ message: { photo: [{ width: 1 }] } })).toBe('rejected');
    expect(decoded({ message: { text: 'x'.repeat(4097) } })).toBe('rejected');
    expect(decoded({ callback_query: { data: 'missing id' } })).toBe('rejected');
    expect(decoded('not an object')).toBe('rejected');
  });
});

describe('TelegramWebhookController', () => {
  const handleUpdate = vi.fn().mockResolvedValue(undefined);
  const controller = new TelegramWebhookController({ handleUpdate } as never);

  beforeEach(() => {

    handleUpdate.mockClear();

  });

  it('hands a valid update to the service', async () => {
    await expect(controller.handleUpdate({ update_id: 1, message: { chat: { id: 5 }, text: '/help' } })).resolves.toEqual({
      ok: true,
    });
    // Without a bot token the service uses the TELEGRAM_BOT_TOKEN bot this webhook belongs to.
    expect(handleUpdate).toHaveBeenCalledWith({ update_id: 1, message: { chat: { id: 5 }, text: '/help' } }, undefined);
  });

  it('hands an update on a per-bot webhook to the service with that bot', async () => {
    const bots = { tokenOf: vi.fn(() => '123:secret') };
    const perBot = new TelegramWebhookController({ handleUpdate } as never, bots as never);

    await expect(perBot.handleBotUpdate('123', { update_id: 3, message: { text: '/help' } })).resolves.toEqual({
      ok: true,
    });
    expect(bots.tokenOf).toHaveBeenCalledWith('123');
    expect(handleUpdate).toHaveBeenCalledWith({ update_id: 3, message: { text: '/help' } }, '123:secret');
  });

  it('answers 200 to a malformed update and drops it, so Telegram does not retry', async () => {
    await expect(controller.handleUpdate({ update_id: 2, message: { chat: { id: { nested: true } } } })).resolves.toEqual({
      ok: true,
    });
    expect(handleUpdate).not.toHaveBeenCalled();
  });
});
