import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum NotificationType {
  STATEMENT_UPLOADED = 'statement.uploaded',
  IMPORT_COMMITTED = 'import.committed',
  CATEGORY_CREATED = 'category.created',
  CATEGORY_UPDATED = 'category.updated',
  CATEGORY_DELETED = 'category.deleted',
  NOTE_MENTIONED = 'note.mentioned',
  MEMBER_INVITED = 'member.invited',
  MEMBER_JOINED = 'member.joined',
  DATA_DELETED = 'data.deleted',
  WORKSPACE_UPDATED = 'workspace.updated',
  PARSING_ERROR = 'parsing.error',
  IMPORT_FAILED = 'import.failed',
  TRANSACTION_UNCATEGORIZED = 'transaction.uncategorized',
  RECEIPT_UNCATEGORIZED = 'receipt.uncategorized',
  PAYABLE_DUE_SOON = 'payable.due_soon',
  PAYABLE_OVERDUE = 'payable.overdue',
  PAYABLE_MARKED_PAID = 'payable.marked_paid',
  BUDGET_WARNING = 'budget.warning',
  BUDGET_EXCEEDED = 'budget.exceeded',
  SUBSCRIPTION_DETECTED = 'subscription.detected',
  SUBSCRIPTION_UPCOMING = 'subscription.upcoming',
  SUBSCRIPTION_PRICE_CHANGED = 'subscription.price_changed',
  TAX_THRESHOLD_WARNING = 'tax.threshold.warning',
  TAX_THRESHOLD_REACHED = 'tax.threshold.reached',
  TAX_DEADLINE_UPCOMING = 'tax.deadline.upcoming',
  TAX_DEADLINE_OVERDUE = 'tax.deadline.overdue',
  TAX_RATES_OFFICIAL_CHANGED = 'tax.rates.official_changed',
}

export enum NotificationCategory {
  WORKSPACE_ACTIVITY = 'workspace_activity',
  SYSTEM = 'system',
}

export enum NotificationSeverity {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

@Entity('notifications')
@Index('IDX_notifications_recipient_read', ['recipientId', 'isRead', 'createdAt'])
@Index('IDX_notifications_workspace_created', ['workspaceId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recipient_id' })
  recipient: Relation<User>;

  @Column({ name: 'recipient_id', type: 'uuid' })
  recipientId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar', length: 64 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 32 })
  category: NotificationCategory;

  @Column({ type: 'varchar', length: 16, default: NotificationSeverity.INFO })
  severity: NotificationSeverity;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  /** False when the user wants this event only by email/Telegram, not in the bell. */
  @Column({ name: 'in_app', type: 'boolean', default: true })
  inApp: boolean;

  /**
   * Channels that still owe a delivery: set when a send is deferred (quiet hours,
   * digest) or failed, cleared once sent. The digest sweep works off this list.
   */
  @Column({ name: 'pending_channels', type: 'jsonb', default: () => "'[]'::jsonb" })
  pendingChannels: string[];

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_name', type: 'varchar', length: 255, nullable: true })
  actorName: string | null;

  @Column({ name: 'entity_type', type: 'varchar', length: 64, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'uuid', nullable: true })
  entityId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
