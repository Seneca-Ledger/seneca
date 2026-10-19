import {
  NotificationDigestMode,
  NotificationPreference,
} from '@/entities/notification-preference.entity';
import { Notification } from '@/entities/notification.entity';
import { User } from '@/entities/user.entity';
import { MailerService } from '@/modules/mailer/mailer.service';
import { NotificationDeliveryService } from '@/modules/notifications/notification-delivery.service';
import { PushService } from '@/modules/push/push.service';
import { TelegramService } from '@/modules/telegram/telegram.service';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('NotificationDeliveryService', () => {
  let service: NotificationDeliveryService;
  let mailerService: { send: jest.Mock };
  let telegramService: { sendPlainMessage: jest.Mock };
  let notificationRepository: { update: jest.Mock; createQueryBuilder: jest.Mock };

  const user = {
    id: 'u1',
    email: 'user@example.com',
    telegramChatId: '555',
    timeZone: 'Europe/Moscow',
  } as User;

  const notification = {
    id: 'n1',
    title: 'Statement uploaded',
    message: 'Anna uploaded a statement',
    pendingChannels: [],
  } as unknown as Notification;

  const preference = (over: Partial<NotificationPreference> = {}) =>
    ({
      id: 'p1',
      userId: 'u1',
      digestMode: NotificationDigestMode.INSTANT,
      quietHoursStart: null,
      quietHoursEnd: null,
      lastDigestAt: null,
      ...over,
    }) as NotificationPreference;

  beforeEach(async () => {
    mailerService = { send: jest.fn(async () => true) };
    telegramService = { sendPlainMessage: jest.fn(async () => ({ messageId: '1' })) };
    notificationRepository = { update: jest.fn(), createQueryBuilder: jest.fn() };

    const testingModule: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDeliveryService,
        { provide: getRepositoryToken(Notification), useValue: notificationRepository },
        { provide: getRepositoryToken(NotificationPreference), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: MailerService, useValue: mailerService },
        { provide: TelegramService, useValue: telegramService },
        { provide: PushService, useValue: { sendToUser: jest.fn(async () => true) } },
      ],
    }).compile();

    service = testingModule.get(NotificationDeliveryService);
  });

  describe('isDeferred', () => {
    // 2026-08-21T23:30Z is 02:30 in Moscow — inside a 22:00-07:00 window.
    const night = new Date(Date.UTC(2026, 7, 21, 23, 30));
    const noon = new Date(Date.UTC(2026, 7, 21, 9, 0));

    it('sends instantly outside quiet hours', () => {
      const prefs = preference({ quietHoursStart: 22, quietHoursEnd: 7 });
      expect(service.isDeferred(prefs, user, noon)).toBe(false);
    });

    it('defers during quiet hours', () => {
      const prefs = preference({ quietHoursStart: 22, quietHoursEnd: 7 });
      expect(service.isDeferred(prefs, user, night)).toBe(true);
    });

    it('defers everything when a digest mode is set', () => {
      const prefs = preference({ digestMode: NotificationDigestMode.DAILY });
      expect(service.isDeferred(prefs, user, noon)).toBe(true);
    });
  });

  describe('deliver', () => {
    it('sends over both channels and reports nothing failed', async () => {
      const failed = await service.deliver(notification, user, ['email', 'telegram']);

      expect(failed).toEqual([]);
      expect(mailerService.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'user@example.com', subject: 'Statement uploaded' }),
      );
      expect(telegramService.sendPlainMessage).toHaveBeenCalledWith(
        '555',
        expect.stringContaining('Statement uploaded'),
        user,
      );
    });

    it('reports email as failed when SMTP is not configured', async () => {
      mailerService.send.mockResolvedValueOnce(false);

      await expect(service.deliver(notification, user, ['email'])).resolves.toEqual(['email']);
    });

    it('reports the channel as failed when the transport throws', async () => {
      telegramService.sendPlainMessage.mockRejectedValueOnce(new Error('bot blocked'));

      await expect(service.deliver(notification, user, ['telegram'])).resolves.toEqual([
        'telegram',
      ]);
    });

    it('drops telegram silently when the user never linked a chat', async () => {
      const unlinked = { ...user, telegramChatId: null } as User;

      await expect(service.deliver(notification, unlinked, ['telegram'])).resolves.toEqual([]);
      expect(telegramService.sendPlainMessage).not.toHaveBeenCalled();
    });

    it('keeps going when one channel fails so the other still arrives', async () => {
      mailerService.send.mockResolvedValueOnce(false);

      const failed = await service.deliver(notification, user, ['email', 'telegram']);

      expect(failed).toEqual(['email']);
      expect(telegramService.sendPlainMessage).toHaveBeenCalled();
    });
  });
});
