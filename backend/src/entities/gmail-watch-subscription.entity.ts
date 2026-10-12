import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Integration } from './integration.entity';

export enum WatchSubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  ERROR = 'error',
}

@Entity('gmail_watch_subscriptions')
export class GmailWatchSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'integration_id', type: 'uuid' })
  integrationId: string;

  @ManyToOne(() => Integration)
  @JoinColumn({ name: 'integration_id' })
  integration: Integration;

  @Column({ name: 'topic_name' })
  topicName: string;

  @Column({ name: 'subscription_name' })
  subscriptionName: string;

  @Column({ type: 'timestamp' })
  expiration: Date;

  @Column({ type: 'varchar', name: 'history_id', nullable: true })
  historyId: string | null;

  @Index('IDX_gmail_watch_subscription_email')
  @Column({ type: 'varchar', name: 'email_address', nullable: true })
  emailAddress: string | null;

  @Column({
    type: 'enum',
    enum: WatchSubscriptionStatus,
    default: WatchSubscriptionStatus.ACTIVE,
  })
  status: WatchSubscriptionStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
