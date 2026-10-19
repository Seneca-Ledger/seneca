import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { APP_NAME } from '../../common/brand';
import { Notification } from '../../entities/notification.entity';
import {
  NotificationChannel,
  NotificationDigestMode,
  NotificationPreference,
} from '../../entities/notification-preference.entity';
import { User } from '../../entities/user.entity';
import { MailerService } from '../mailer/mailer.service';
import { PushService } from '../push/push.service';
import { TelegramService } from '../telegram/telegram.service';
import { notificationUrl } from './notification-url';
import { getLocalHour, isWithinQuietHours } from './quiet-hours.util';

/** Digests go out in the morning rather than at midnight, when nobody reads them. */
const DIGEST_HOUR = 9;
const WEEKLY_DIGEST_WEEKDAY = 1; // Monday
const DIGEST_BATCH_LIMIT = 200;

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailerService: MailerService,
    private readonly telegramService: TelegramService,
    private readonly pushService: PushService,
  ) {}

  /**
   * Decides whether the push channels can go out right now. Quiet hours and any
   * digest mode other than instant mean "later" — the sweep picks those up.
   */
  isDeferred(preference: NotificationPreference, user: Pick<User, 'timeZone'>, now = new Date()) {
    if (preference.digestMode && preference.digestMode !== NotificationDigestMode.INSTANT) {
      return true;
    }

    return isWithinQuietHours(
      getLocalHour(now, user.timeZone),
      preference.quietHoursStart,
      preference.quietHoursEnd,
    );
  }

  /**
   * Sends one notification over the given channels.
   * Returns the channels that did NOT go through, so the caller can keep them pending.
   */
  async deliver(notification: Notification, user: User, channels: string[]): Promise<string[]> {
    const failed: string[] = [];

    for (const channel of channels) {
      try {
        const sent = await this.sendOne(notification, user, channel);
        if (!sent) {
          failed.push(channel);
        }
      } catch (error) {
        this.logger.error(
          `Failed to deliver notification ${notification.id} over ${channel}`,
          error instanceof Error ? error.stack : undefined,
        );
        failed.push(channel);
      }
    }

    return failed;
  }

  private async sendOne(notification: Notification, user: User, channel: string): Promise<boolean> {
    if (channel === NotificationChannel.EMAIL) {
      return this.mailerService.send({
        to: user.email,
        subject: notification.title,
        text: notification.message,
        user,
      });
    }

    if (channel === NotificationChannel.TELEGRAM) {
      if (!user.telegramChatId) {
        // Nothing to retry against until the user links Telegram — drop it.
        return true;
      }
      await this.telegramService.sendPlainMessage(
        user.telegramChatId,
        `${notification.title}\n\n${notification.message}`,
        user,
      );
      return true;
    }

    if (channel === NotificationChannel.PUSH) {
      return this.pushService.sendToUser(user.id, {
        title: notification.title,
        body: notification.message,
        url: notificationUrl(notification),
        tag: notification.id,
      });
    }

    return true;
  }

  /**
   * Picks up everything that was deferred or failed. Runs often so that instant
   * notifications held back by quiet hours go out soon after the window closes.
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async flushPendingDeliveries(now = new Date()): Promise<void> {
    const recipients = await this.findRecipientsWithPending();

    for (const recipientId of recipients) {
      try {
        await this.flushForRecipient(recipientId, now);
      } catch (error) {
        this.logger.error(
          `Failed to flush notifications for user ${recipientId}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async findRecipientsWithPending(): Promise<string[]> {
    const rows = await this.notificationRepository
      .createQueryBuilder('notification')
      .select('DISTINCT notification.recipient_id', 'recipientId')
      .where("notification.pending_channels <> '[]'::jsonb")
      .limit(DIGEST_BATCH_LIMIT)
      .getRawMany<{ recipientId: string }>();

    return rows.map(row => row.recipientId);
  }

  private async flushForRecipient(recipientId: string, now: Date): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: recipientId } });
    if (!user) {
      return;
    }

    const preference = await this.preferenceRepository.findOne({
      where: { userId: recipientId },
    });
    if (!preference) {
      return;
    }

    const localHour = getLocalHour(now, user.timeZone);
    if (isWithinQuietHours(localHour, preference.quietHoursStart, preference.quietHoursEnd)) {
      return;
    }

    if (!this.isDigestDue(preference, now, localHour)) {
      return;
    }

    const pending = await this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.recipient_id = :recipientId', { recipientId })
      .andWhere("notification.pending_channels <> '[]'::jsonb")
      .orderBy('notification.created_at', 'ASC')
      .limit(DIGEST_BATCH_LIMIT)
      .getMany();

    if (!pending.length) {
      return;
    }

    const digest = preference.digestMode !== NotificationDigestMode.INSTANT;
    await (digest
      ? this.sendDigest(pending, user, preference)
      : this.sendIndividually(pending, user));
  }

  /** Instant mode is always due; daily/weekly wait for their morning slot. */
  private isDigestDue(preference: NotificationPreference, now: Date, localHour: number): boolean {
    if (preference.digestMode === NotificationDigestMode.INSTANT) {
      return true;
    }

    if (localHour < DIGEST_HOUR) {
      return false;
    }

    const last = preference.lastDigestAt ? preference.lastDigestAt.getTime() : 0;
    const hoursSinceLast = (now.getTime() - last) / (60 * 60 * 1000);

    if (preference.digestMode === NotificationDigestMode.WEEKLY) {
      return now.getUTCDay() === WEEKLY_DIGEST_WEEKDAY && hoursSinceLast >= 24 * 6;
    }

    return hoursSinceLast >= 20;
  }

  private async sendIndividually(pending: Notification[], user: User): Promise<void> {
    for (const notification of pending) {
      const failed = await this.deliver(notification, user, notification.pendingChannels ?? []);
      await this.notificationRepository.update(notification.id, { pendingChannels: failed });
    }
  }

  private async sendDigest(
    pending: Notification[],
    user: User,
    preference: NotificationPreference,
  ): Promise<void> {
    const channels = [...new Set(pending.flatMap(item => item.pendingChannels ?? []))];
    const subject = `${APP_NAME}: ${pending.length}`;
    const body = pending.map(item => `• ${item.title}\n  ${item.message}`).join('\n\n');

    let delivered = true;

    if (channels.includes(NotificationChannel.EMAIL)) {
      delivered =
        (await this.mailerService.send({ to: user.email, subject, text: body, user })) && delivered;
    }

    if (channels.includes(NotificationChannel.TELEGRAM) && user.telegramChatId) {
      await this.telegramService.sendPlainMessage(
        user.telegramChatId,
        `${subject}\n\n${body}`,
        user,
      );
    }

    if (channels.includes(NotificationChannel.PUSH)) {
      // One push for the whole digest; the phone would not want one per item.
      delivered =
        (await this.pushService.sendToUser(user.id, {
          title: subject,
          body: pending
            .slice(0, 3)
            .map(item => item.title)
            .join(' · '),
          url: '/dashboard',
          tag: 'digest',
        })) && delivered;
    }

    if (!delivered) {
      return;
    }

    await this.notificationRepository.update(
      pending.map(item => item.id),
      { pendingChannels: [] },
    );
    await this.preferenceRepository.update(preference.id, { lastDigestAt: new Date() });
  }
}
