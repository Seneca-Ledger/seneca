import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationChannel {
  IN_APP = 'inApp',
  EMAIL = 'email',
  TELEGRAM = 'telegram',
  /** Web push to the browsers and installed apps the user subscribed. */
  PUSH = 'push',
}

export enum NotificationDigestMode {
  INSTANT = 'instant',
  DAILY = 'daily',
  WEEKLY = 'weekly',
}

/** Which channels a single event should reach the user through. */
export type NotificationChannelSet = {
  inApp: boolean;
  email: boolean;
  telegram: boolean;
  /** Optional: rows written before the push channel existed have no key. */
  push?: boolean;
};

export type NotificationChannelMatrix = Record<string, NotificationChannelSet>;

@Entity('notification_preferences')
@Unique('UQ_notification_preferences_user', ['userId'])
export class NotificationPreference {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'statement_uploaded', type: 'boolean', default: true })
  statementUploaded: boolean;

  @Column({ name: 'import_committed', type: 'boolean', default: true })
  importCommitted: boolean;

  @Column({ name: 'category_changes', type: 'boolean', default: true })
  categoryChanges: boolean;

  @Column({ name: 'member_activity', type: 'boolean', default: true })
  memberActivity: boolean;

  @Column({ name: 'data_deleted', type: 'boolean', default: true })
  dataDeleted: boolean;

  @Column({ name: 'workspace_updated', type: 'boolean', default: true })
  workspaceUpdated: boolean;

  @Column({ name: 'parsing_errors', type: 'boolean', default: true })
  parsingErrors: boolean;

  @Column({ name: 'import_failures', type: 'boolean', default: true })
  importFailures: boolean;

  @Column({ name: 'uncategorized_items', type: 'boolean', default: true })
  uncategorizedItems: boolean;

  /** "Looks like a subscription — confirm?" prompts after an import. */
  @Column({ name: 'subscription_prompts', type: 'boolean', default: true })
  subscriptionPrompts: boolean;

  /**
   * Per-event delivery matrix, the source of truth since the channels migration.
   * The booleans above are kept only so a rollback does not lose settings.
   * ponytail: drop the booleans once this has shipped for a release.
   */
  @Column({ type: 'jsonb', nullable: false, default: () => "'{}'::jsonb" })
  channels: NotificationChannelMatrix;

  @Column({
    name: 'digest_mode',
    type: 'varchar',
    length: 16,
    default: NotificationDigestMode.INSTANT,
  })
  digestMode: NotificationDigestMode;

  /** Local hour (0-23) when quiet hours begin; null disables them. May wrap past midnight. */
  @Column({ name: 'quiet_hours_start', type: 'smallint', nullable: true })
  quietHoursStart: number | null;

  @Column({ name: 'quiet_hours_end', type: 'smallint', nullable: true })
  quietHoursEnd: number | null;

  /** When the last daily/weekly digest went out, so a sweep never sends twice. */
  @Column({ name: 'last_digest_at', type: 'timestamptz', nullable: true })
  lastDigestAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
