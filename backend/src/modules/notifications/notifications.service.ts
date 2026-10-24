import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, type Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { withoutNulls } from '../../common/effect/without-nulls';
import { isDemoWorkspace } from '../../common/workspaces/demo-workspaces';
import { isVersionWorkspace, STANDARD_WORKSPACE } from '../../common/workspaces/version-workspaces';
import type { UpdateNotificationPreferencesBody } from '../../contracts';
import {
  Notification,
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from '../../entities/notification.entity';
import {
  NotificationChannel,
  type NotificationChannelMatrix,
  type NotificationChannelSet,
  NotificationPreference,
} from '../../entities/notification-preference.entity';
import { User } from '../../entities/user.entity';
import { WorkspaceMember } from '../../entities/workspace-member.entity';
import { NotificationDeliveryService } from './notification-delivery.service';
import type { NotificationParams } from './notification-params';
import { type NotificationMessageKey, renderNotification } from './notification-translations';

/**
 * Notifications about a statement or receipt that has since been trashed or
 * deleted lead to a "not found" page, so they are hidden from the list and the
 * unread count. Restoring a statement from the trash brings them back.
 */
const POINTS_AT_EXISTING_DOCUMENT = `(
  notification.entity_id IS NULL
  OR notification.entity_type IS NULL
  OR notification.entity_type NOT IN ('statement', 'receipt')
  OR EXISTS (
    SELECT 1 FROM statements s
    WHERE notification.entity_type = 'statement' AND s.id = notification.entity_id AND s.deleted_at IS NULL
  )
  OR EXISTS (
    SELECT 1 FROM receipts r
    WHERE notification.entity_type = 'receipt' AND r.id = notification.entity_id
  )
)`;

type NotificationPreferenceKey =
  | 'statementUploaded'
  | 'importCommitted'
  | 'categoryChanges'
  | 'memberActivity'
  | 'dataDeleted'
  | 'workspaceUpdated'
  | 'parsingErrors'
  | 'importFailures'
  | 'uncategorizedItems'
  | 'subscriptionPrompts';

/** Anything that is not a real boolean leaves the current setting alone — a
 * truthy string must not be able to switch a channel on. */
const pickBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const NOTIFICATION_PREFERENCE_KEYS: NotificationPreferenceKey[] = [
  'statementUploaded',
  'importCommitted',
  'categoryChanges',
  'memberActivity',
  'dataDeleted',
  'workspaceUpdated',
  'parsingErrors',
  'importFailures',
  'uncategorizedItems',
  'subscriptionPrompts',
];

const NOTIFICATION_PREFERENCE_MAP: Record<NotificationType, NotificationPreferenceKey> = {
  [NotificationType.STATEMENT_UPLOADED]: 'statementUploaded',
  [NotificationType.IMPORT_COMMITTED]: 'importCommitted',
  [NotificationType.CATEGORY_CREATED]: 'categoryChanges',
  [NotificationType.CATEGORY_UPDATED]: 'categoryChanges',
  [NotificationType.CATEGORY_DELETED]: 'categoryChanges',
  [NotificationType.NOTE_MENTIONED]: 'memberActivity',
  [NotificationType.MEMBER_INVITED]: 'memberActivity',
  [NotificationType.MEMBER_JOINED]: 'memberActivity',
  [NotificationType.DATA_DELETED]: 'dataDeleted',
  [NotificationType.WORKSPACE_UPDATED]: 'workspaceUpdated',
  [NotificationType.PARSING_ERROR]: 'parsingErrors',
  [NotificationType.IMPORT_FAILED]: 'importFailures',
  [NotificationType.TRANSACTION_UNCATEGORIZED]: 'uncategorizedItems',
  [NotificationType.RECEIPT_UNCATEGORIZED]: 'uncategorizedItems',
  [NotificationType.PAYABLE_DUE_SOON]: 'workspaceUpdated',
  [NotificationType.PAYABLE_OVERDUE]: 'workspaceUpdated',
  [NotificationType.PAYABLE_MARKED_PAID]: 'workspaceUpdated',
  [NotificationType.BUDGET_WARNING]: 'workspaceUpdated',
  [NotificationType.TAX_THRESHOLD_WARNING]: 'workspaceUpdated',
  [NotificationType.TAX_THRESHOLD_REACHED]: 'workspaceUpdated',
  [NotificationType.TAX_DEADLINE_UPCOMING]: 'workspaceUpdated',
  [NotificationType.TAX_DEADLINE_OVERDUE]: 'workspaceUpdated',
  [NotificationType.TAX_RATES_OFFICIAL_CHANGED]: 'workspaceUpdated',
  [NotificationType.BUDGET_EXCEEDED]: 'workspaceUpdated',
  [NotificationType.SUBSCRIPTION_DETECTED]: 'subscriptionPrompts',
  [NotificationType.SUBSCRIPTION_UPCOMING]: 'workspaceUpdated',
  [NotificationType.SUBSCRIPTION_PRICE_CHANGED]: 'workspaceUpdated',
};

export interface CreateNotificationPayload {
  recipientId: string;
  workspaceId?: string | null;
  type: NotificationType;
  category: NotificationCategory;
  severity?: NotificationSeverity;
  messageKey: NotificationMessageKey;
  messageParams: NotificationParams;
  actorId?: string | null;
  actorName?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
  /**
   * Set for a notification that is a running summary rather than an event
   * (upcoming charges): the recipient keeps one row of this type per
   * workspace. The same fingerprint again changes nothing; a different one
   * rewrites that row in place and brings it back as unread.
   */
  fingerprint?: string;
}

export interface WorkspaceNotificationPayload {
  workspaceId: string;
  actorId?: string | null;
  type: NotificationType;
  category: NotificationCategory;
  severity?: NotificationSeverity;
  messageKey: NotificationMessageKey;
  messageParams: NotificationParams;
  actorName?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  meta?: Record<string, unknown> | null;
  fingerprint?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferenceRepository: Repository<NotificationPreference>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(WorkspaceMember)
    private readonly workspaceMemberRepository: Repository<WorkspaceMember>,
    private readonly eventEmitter: EventEmitter2,
    private readonly deliveryService: NotificationDeliveryService,
  ) {}

  async create(payload: CreateNotificationPayload): Promise<Notification | null> {
    // A past version is a copy of old books, not where anything happens: no
    // event in it is news, whichever job or listener reported it. Nor is
    // anything in a demo, whose sample data is dated around another day.
    const manager = this.notificationRepository.manager;
    if (
      (await isVersionWorkspace(manager, payload.workspaceId)) ||
      (await isDemoWorkspace(manager, payload.workspaceId))
    ) {
      return null;
    }
    return this.notify(payload);
  }

  private async notify(payload: CreateNotificationPayload): Promise<Notification | null> {
    const preferences = await this.getPreferences(payload.recipientId);
    const channels = this.resolveChannels(preferences, payload.type);

    // Every channel off for this event: the user asked not to hear about it at all.
    if (!(channels.inApp || channels.email || channels.telegram || channels.push)) {
      return null;
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.recipientId },
    });
    const { title, message } = renderNotification(
      user?.locale ?? 'en',
      payload.messageKey,
      payload.messageParams,
    );

    const pushChannels = this.resolvePushChannels(channels);
    const deferred = Boolean(
      pushChannels.length && user && this.deliveryService.isDeferred(preferences, user),
    );

    const fields = {
      type: payload.type,
      category: payload.category,
      severity: payload.severity ?? NotificationSeverity.INFO,
      title,
      message,
      inApp: channels.inApp,
      // Deferred sends are parked here; immediate ones are cleared right after.
      pendingChannels: deferred ? pushChannels : [],
      actorId: payload.actorId ?? null,
      actorName: payload.actorName ?? null,
      entityType: payload.entityType ?? null,
      entityId: payload.entityId ?? null,
      meta: payload.meta ?? null,
    };

    const { row: saved, changed } = await this.store(payload, fields);
    if (!changed) {
      // Nothing new: the read state, the place in the list and the sends stay as they were.
      return saved;
    }

    if (channels.inApp) {
      this.eventEmitter.emit('notification.created', saved);
    }

    if (!deferred && user) {
      await this.deliverNow(saved, user, pushChannels);
    }

    return saved;
  }

  /**
   * Inserts the row, or — for a fingerprinted notification — rewrites the
   * recipient's existing one when its content changed.
   */
  private async store(
    payload: CreateNotificationPayload,
    plainFields: Partial<Notification>,
  ): Promise<{ row: Notification; changed: boolean }> {
    const fields = payload.fingerprint
      ? { ...plainFields, meta: { ...plainFields.meta, fingerprint: payload.fingerprint } }
      : plainFields;
    // Without a workspace the lookup would match every workspace's row.
    const current =
      payload.fingerprint && payload.workspaceId
        ? await this.takeCurrent(payload.recipientId, payload.workspaceId, payload.type)
        : null;

    if (!current) {
      const row = await this.notificationRepository.save(
        this.notificationRepository.create({
          recipientId: payload.recipientId,
          workspaceId: payload.workspaceId ?? undefined,
          ...fields,
        }),
      );
      return { row, changed: true };
    }
    if (current.meta?.fingerprint === payload.fingerprint) {
      return { row: current, changed: false };
    }
    const changes = { ...fields, isRead: false, createdAt: new Date() };
    await this.notificationRepository.update(
      { id: current.id, recipientId: payload.recipientId },
      // jsonb `meta` trips the deep-partial typing; the shape is the entity's own.
      changes as QueryDeepPartialEntity<Notification>,
    );
    return { row: Object.assign(current, changes), changed: true };
  }

  /**
   * The recipient's one row of a fingerprinted type in this workspace. Copies
   * left over from runs that still inserted a new row each time are removed.
   */
  private async takeCurrent(
    recipientId: string,
    workspaceId: string,
    type: NotificationType,
  ): Promise<Notification | null> {
    const [current, ...stale] = await this.notificationRepository.find({
      where: { recipientId, workspaceId, type },
      order: { createdAt: 'DESC' },
    });
    if (stale.length > 0) {
      await this.notificationRepository.delete({
        recipientId,
        workspaceId,
        id: In(stale.map(row => row.id)),
      });
    }
    return current ?? null;
  }

  /**
   * Removes a workspace's notifications of these types whose meta contains
   * `match` — reminders about something that is no longer live (a VAT
   * return that was filed, or a "due soon" superseded by "overdue").
   */
  async removeForWorkspace(
    workspaceId: string,
    types: NotificationType[],
    match: Record<string, string>,
  ): Promise<number> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .delete()
      .from(Notification)
      .where('workspace_id = :workspaceId', { workspaceId })
      .andWhere('type IN (:...types)', { types })
      .andWhere('meta @> CAST(:match AS jsonb)', { match: JSON.stringify(match) })
      .execute();
    return result.affected ?? 0;
  }

  /** In-app is rendered from the row itself; only these two need sending out. */
  private resolvePushChannels(channels: NotificationChannelSet): NotificationChannel[] {
    return [
      ...(channels.email ? [NotificationChannel.EMAIL] : []),
      ...(channels.telegram ? [NotificationChannel.TELEGRAM] : []),
      ...(channels.push ? [NotificationChannel.PUSH] : []),
    ];
  }

  /** Sends the push channels straight away; whatever fails stays pending for the sweep. */
  private async deliverNow(
    notification: Notification,
    user: User,
    pushChannels: NotificationChannel[],
  ): Promise<void> {
    if (!pushChannels.length) {
      return;
    }

    const failed = await this.deliveryService.deliver(notification, user, pushChannels);
    if (!failed.length) {
      return;
    }

    notification.pendingChannels = failed;
    await this.notificationRepository.update(notification.id, { pendingChannels: failed });
  }

  /** Falls back to the legacy booleans for rows written before the channels migration. */
  private resolveChannels(
    preferences: NotificationPreference,
    type: NotificationType,
  ): NotificationChannelSet {
    const key = NOTIFICATION_PREFERENCE_MAP[type];
    if (!key) {
      return { inApp: true, email: false, telegram: false };
    }

    const configured = preferences.channels?.[key];
    if (configured) {
      return {
        inApp: Boolean(configured.inApp),
        email: Boolean(configured.email),
        telegram: Boolean(configured.telegram),
        push: Boolean(configured.push),
      };
    }

    return { inApp: Boolean(preferences[key]), email: false, telegram: false };
  }

  async createForWorkspaceMembers(payload: WorkspaceNotificationPayload): Promise<number> {
    // No one is told about a past version (see `create`).
    const members = await this.workspaceMemberRepository.find({
      where: { workspaceId: payload.workspaceId, workspace: STANDARD_WORKSPACE },
      select: {
        userId: true,
      },
    });

    const recipientIds = members
      .map(member => member.userId)
      .filter(userId => !payload.actorId || userId !== payload.actorId);

    if (recipientIds.length === 0) {
      return 0;
    }

    const results = await Promise.all(
      recipientIds.map(recipientId =>
        this.create({
          recipientId,
          workspaceId: payload.workspaceId,
          type: payload.type,
          category: payload.category,
          severity: payload.severity,
          messageKey: payload.messageKey,
          messageParams: payload.messageParams,
          actorId: payload.actorId ?? null,
          actorName: payload.actorName ?? null,
          entityType: payload.entityType ?? null,
          entityId: payload.entityId ?? null,
          meta: payload.meta ?? null,
          fingerprint: payload.fingerprint,
        }).catch(error => {
          this.logger.error(
            `Failed to create notification for user ${recipientId}`,
            error instanceof Error ? error.stack : undefined,
          );
          return null;
        }),
      ),
    );

    return results.filter(Boolean).length;
  }

  async findByRecipient(
    recipientId: string,
    workspaceId: string,
    limit = 30,
    offset = 0,
  ): Promise<{ items: Notification[]; total: number; limit: number; offset: number }> {
    const normalizedLimit = Math.min(Math.max(limit, 1), 100);
    const normalizedOffset = Math.max(offset, 0);

    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.recipientId = :recipientId', { recipientId })
      .andWhere('notification.inApp = true')
      .andWhere(POINTS_AT_EXISTING_DOCUMENT)
      .orderBy('notification.createdAt', 'DESC')
      .take(normalizedLimit)
      .skip(normalizedOffset);

    qb.andWhere('notification.workspaceId = :workspaceId', { workspaceId });

    const [items, total] = await qb.getManyAndCount();
    return { items, total, limit: normalizedLimit, offset: normalizedOffset };
  }

  async getUnreadCount(recipientId: string, workspaceId: string): Promise<number> {
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.recipientId = :recipientId', { recipientId })
      .andWhere('notification.inApp = true')
      .andWhere('notification.isRead = false')
      .andWhere(POINTS_AT_EXISTING_DOCUMENT);

    qb.andWhere('notification.workspaceId = :workspaceId', { workspaceId });

    return qb.getCount();
  }

  async markAsRead(recipientId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) {
      return 0;
    }

    const result = await this.notificationRepository.update(
      {
        recipientId,
        id: In(ids),
        isRead: false,
      },
      {
        isRead: true,
      },
    );

    return result.affected ?? 0;
  }

  async markAllAsRead(recipientId: string, workspaceId: string): Promise<number> {
    const qb = this.notificationRepository
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('recipient_id = :recipientId', { recipientId })
      .andWhere('is_read = false');

    qb.andWhere('workspace_id = :workspaceId', { workspaceId });

    const result = await qb.execute();
    return result.affected ?? 0;
  }

  async getPreferences(userId: string): Promise<NotificationPreference> {
    const existing = await this.preferenceRepository.findOne({ where: { userId } });
    const preferences =
      existing ??
      (await this.preferenceRepository.save(this.preferenceRepository.create({ userId })));

    // Rows created after the migration start with an empty matrix. Fill it in once
    // so every consumer sees the same shape instead of reimplementing the fallback.
    if (!Object.keys(preferences.channels ?? {}).length) {
      preferences.channels = this.normalizeChannels(preferences, {});
      await this.preferenceRepository.update(preferences.id, { channels: preferences.channels });
    }

    return preferences;
  }

  async updatePreferences(
    userId: string,
    dto: UpdateNotificationPreferencesBody,
  ): Promise<NotificationPreference> {
    const preferences = await this.getPreferences(userId);
    const { channels, quietHoursStart, quietHoursEnd, ...rest } = dto;
    // null switches quiet hours off; for every other setting it leaves it as it was.
    Object.assign(preferences, withoutNulls(rest));
    if (quietHoursStart !== undefined) preferences.quietHoursStart = quietHoursStart;
    if (quietHoursEnd !== undefined) preferences.quietHoursEnd = quietHoursEnd;

    if (channels) {
      preferences.channels = this.normalizeChannels(
        preferences,
        Object.fromEntries(Object.entries(channels).map(([key, set]) => [key, withoutNulls(set)])),
      );
    }

    return this.preferenceRepository.save(preferences);
  }

  /**
   * The matrix lands in a jsonb column, so only known event keys and real booleans
   * are allowed through — never the raw request body.
   */
  private normalizeChannels(
    preferences: NotificationPreference,
    incoming: Record<
      string,
      { inApp?: boolean; email?: boolean; telegram?: boolean; push?: boolean }
    >,
  ): NotificationChannelMatrix {
    const normalized: NotificationChannelMatrix = {};

    for (const key of NOTIFICATION_PREFERENCE_KEYS) {
      const current = preferences.channels?.[key] ?? {
        inApp: Boolean(preferences[key]),
        email: false,
        telegram: false,
        push: false,
      };
      const patch = incoming[key];

      normalized[key] = patch
        ? {
            inApp: pickBoolean(patch.inApp, current.inApp),
            email: pickBoolean(patch.email, current.email),
            telegram: pickBoolean(patch.telegram, current.telegram),
            push: pickBoolean(patch.push, current.push ?? false),
          }
        : { ...current, push: current.push ?? false };
    }

    return normalized;
  }

  /** True when the event reaches the user over at least one channel. */
  async isTypeEnabled(userId: string, type: NotificationType): Promise<boolean> {
    const preferences = await this.getPreferences(userId);
    const channels = this.resolveChannels(preferences, type);
    return channels.inApp || channels.email || channels.telegram;
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupOldNotifications(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    const result = await this.notificationRepository.delete({
      createdAt: LessThan(cutoffDate),
    });

    if ((result.affected ?? 0) > 0) {
      this.logger.log(`Deleted ${result.affected} old notifications`);
    }
  }
}
