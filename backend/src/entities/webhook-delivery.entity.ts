import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { WebhookSubscription } from './webhook-subscription.entity';

export enum WebhookDeliveryStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCESS = 'success',
  FAILED = 'failed',
  EXHAUSTED = 'exhausted',
}

@Entity('webhook_deliveries')
@Index('IDX_webhook_deliveries_status_next', ['status', 'nextAttemptAt'])
@Index('IDX_webhook_deliveries_subscription', ['subscriptionId'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subscription_id', type: 'uuid' })
  subscriptionId: string;

  @ManyToOne(() => WebhookSubscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: Relation<WebhookSubscription>;

  @Column({ type: 'varchar', length: 64 })
  event: string;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: WebhookDeliveryStatus,
    default: WebhookDeliveryStatus.PENDING,
  })
  status: WebhookDeliveryStatus;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  @Column({ name: 'max_attempts', type: 'int', default: 3 })
  maxAttempts: number;

  @Column({ name: 'next_attempt_at', type: 'timestamp', nullable: true })
  nextAttemptAt: Date | null;

  @Column({ name: 'last_attempted_at', type: 'timestamp', nullable: true })
  lastAttemptedAt: Date | null;

  @Column({ name: 'last_response_code', type: 'int', nullable: true })
  lastResponseCode: number | null;

  @Column({ name: 'last_response_body', type: 'text', nullable: true })
  lastResponseBody: string | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'locked_at', type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ name: 'locked_by', type: 'varchar', length: 128, nullable: true })
  lockedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
