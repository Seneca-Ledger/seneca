import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  Unique,
} from 'typeorm';
import { Subscription } from './subscription.entity';
import { Transaction } from './transaction.entity';
import { Workspace } from './workspace.entity';

export enum SubscriptionChargeMatchStatus {
  MATCHED = 'matched',
  PRICE_CHANGED = 'price_changed',
  DATE_SHIFTED = 'date_shifted',
}

@Entity('subscription_charges')
@Unique('UQ_subscription_charges_transaction', ['transactionId'])
@Index('IDX_subscription_charges_subscription_date', ['subscriptionId', 'chargeDate'])
export class SubscriptionCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subscription_id' })
  subscription: Relation<Subscription>;

  @Column({ name: 'subscription_id', type: 'uuid' })
  subscriptionId: string;

  /** Null for a payment recorded by hand and not linked to its bank row yet. */
  @ManyToOne(() => Transaction, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Relation<Transaction | null>;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ length: 10 })
  currency: string;

  @Column({ name: 'charge_date', type: 'date' })
  chargeDate: Date;

  @Column({ name: 'expected_amount', type: 'decimal', precision: 15, scale: 2 })
  expectedAmount: number;

  @Column({ name: 'expected_date', type: 'date', nullable: true })
  expectedDate: Date | null;

  @Column({
    name: 'match_status',
    type: 'enum',
    enum: SubscriptionChargeMatchStatus,
    enumName: 'subscription_charges_match_status_enum',
  })
  matchStatus: SubscriptionChargeMatchStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
