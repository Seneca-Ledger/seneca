import { TelegramController } from '@/modules/telegram/telegram.controller';

describe('TelegramController', () => {
  it('parses pagination and returns service result', async () => {
    const telegramService = {
      listReports: vi.fn(async () => ({ items: [], total: 0 })),
      sendReport: vi.fn(async () => ({ ok: true })),
    };
    const controller = new TelegramController(telegramService as any, {} as any);

    const reports = await controller.listReports({ id: 'u1' } as any, { page: 2, limit: 10 });
    expect(reports).toEqual({ items: [], total: 0 });
    expect(telegramService.listReports).toHaveBeenCalledWith({ id: 'u1' }, 2, 10);
  });

  it('issues the Connect link for the workspace that is open', async () => {
    const link = { url: 'https://t.me/seneca_bot?start=x', expiresAt: '2026-10-18T10:00:00.000Z' };
    const telegramBots = { createLink: vi.fn(async () => link) };
    const controller = new TelegramController({} as any, telegramBots as any);

    await expect(controller.createLink({ id: 'u1' } as any, 'ws-open')).resolves.toEqual(link);
    expect(telegramBots.createLink).toHaveBeenCalledWith({ id: 'u1' }, 'ws-open');
  });
});
