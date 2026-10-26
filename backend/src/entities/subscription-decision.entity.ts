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
import { Subscription } from './subscription.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum SubscriptionDecisionType {
  OWNER_ASSIGNED = 'owner_assigned',
  KEEP = 'keep',
  REVIEW = 'review',
  CANCELLED = 'cancelled',
  PRICE_REDUCED = 'price_reduced',
}

@Entity('subscription_decisions')
@Index('IDX_subscription_decisions_subscription_created', ['subscriptionId', 'createdAt'])
@Index('IDX_subscription_decisions_workspace_created', ['workspaceId', 'createdAt'])
export class SubscriptionDecision {
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

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor: Relation<User | null>;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ type: 'enum', enum: SubscriptionDecisionType })
  decision: SubscriptionDecisionType;

  @Column({ name: 'owner_id', type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'savings_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  savingsAmount: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
