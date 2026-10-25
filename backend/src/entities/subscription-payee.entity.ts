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
import { Payee } from './payee.entity';
import { Subscription } from './subscription.entity';
import { Workspace } from './workspace.entity';

/**
 * A payee whose new rows become payments of this subscription on their own.
 * Learned when a person links one of the payee's rows to the subscription;
 * applied only while it is the one active subscription with that payee.
 */
@Entity('subscription_payees')
@Unique('UQ_subscription_payees_subscription_payee', ['subscriptionId', 'payeeId'])
@Index('IDX_subscription_payees_workspace_payee', ['workspaceId', 'payeeId'])
export class SubscriptionPayee {
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

  @ManyToOne(() => Payee, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payee_id' })
  payee: Relation<Payee>;

  @Column({ name: 'payee_id', type: 'uuid' })
  payeeId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
