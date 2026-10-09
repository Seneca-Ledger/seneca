import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum SubscriptionFrequency {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

export enum SubscriptionStatus {
  DETECTED = 'detected',
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELLED = 'cancelled',
}

export enum SubscriptionReviewStatus {
  CURRENT = 'current',
  NEEDS_REVIEW = 'needs_review',
}

export enum SubscriptionRiskStatus {
  NONE = 'none',
  PRICE_CHANGED = 'price_changed',
  DATE_SHIFTED = 'date_shifted',
  MISSING_CHARGE = 'missing_charge',
}

@Entity('subscriptions')
@Unique('UQ_subscriptions_workspace_vendor_frequency', ['workspaceId', 'vendorName', 'frequency'])
@Index('IDX_subscriptions_workspace_status', ['workspaceId', 'status'])
@Index('IDX_subscriptions_workspace_next_charge', ['workspaceId', 'nextChargeDate'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'vendor_name', length: 255 })
  vendorName: string;

  @Column({ name: 'vendor_raw', length: 255, nullable: true })
  vendorRaw: string | null;

  // The vendor's website host, used to fetch a brand icon. Null falls back to
  // initials; detected subscriptions start null until somebody reviews them.
  @Column({ name: 'vendor_domain', length: 253, nullable: true })
  vendorDomain: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column()
  currency: string;

  @Column({ type: 'enum', enum: SubscriptionFrequency })
  frequency: SubscriptionFrequency;

  @Column({ type: 'enum', enum: SubscriptionStatus, default: SubscriptionStatus.DETECTED })
  status: SubscriptionStatus;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_id' })
  owner: User | null;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ name: 'review_at', type: 'date', nullable: true })
  reviewAt: Date | null;

  @Column({
    name: 'review_status',
    type: 'enum',
    enum: SubscriptionReviewStatus,
    default: SubscriptionReviewStatus.CURRENT,
  })
  reviewStatus: SubscriptionReviewStatus;

  @Column({
    name: 'risk_status',
    type: 'enum',
    enum: SubscriptionRiskStatus,
    default: SubscriptionRiskStatus.NONE,
  })
  riskStatus: SubscriptionRiskStatus;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null;

  @Column({ name: 'realized_annual_savings', type: 'decimal', precision: 15, scale: 2, default: 0 })
  realizedAnnualSavings: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence: number | null;

  @Column({ name: 'next_charge_date', type: 'date', nullable: true })
  nextChargeDate: Date | null;

  @Column({ name: 'last_charge_date', type: 'date', nullable: true })
  lastChargeDate: Date | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  /** "I used it" taps; with `usageSince` they give a cost per use. */
  @Column({ name: 'usage_count', type: 'int', default: 0 })
  usageCount: number;

  @Column({ name: 'usage_since', type: 'timestamptz', nullable: true })
  usageSince: Date | null;

  @Column({ name: 'last_used_at', type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  /** The savings goal that sets money aside for the next quarterly or annual charge. */
  @Column({ name: 'sinking_goal_id', type: 'uuid', nullable: true })
  sinkingGoalId: string | null;

  @Column({ name: 'detection_meta', type: 'jsonb', nullable: true })
  detectionMeta: Record<string, unknown> | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
