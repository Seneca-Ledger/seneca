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
import { Goal } from './goal.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum GoalItemStatus {
  PLANNED = 'planned',
  PAID = 'paid',
}

/**
 * One line of a goal's cost estimate: the visa, the deposit, the container.
 *
 * A goal's `targetAmount` stays what the user declared — these rows are the
 * breakdown of how that number was arrived at, not a replacement for it. Keeping
 * the two apart is what lets the plan say "the estimate has drifted 400k above
 * the target", which is the whole point of writing the estimate down.
 *
 * `estimatedAmount` is what the line was expected to cost; `actualAmount` is
 * what it really cost, and stays null until the money moves. A line is never
 * rewritten to hide a bad estimate — the estimate stands and the actual is
 * recorded beside it.
 */
@Entity('goal_items')
@Index('IDX_goal_items_workspace_goal', ['workspaceId', 'goalId'])
@Index('UQ_goal_items_transaction', ['transactionId'], {
  unique: true,
  where: '"transaction_id" IS NOT NULL',
})
export class GoalItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Goal, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goal_id' })
  goal: Relation<Goal>;

  @Column({ name: 'goal_id', type: 'uuid' })
  goalId: string;

  @Column({ length: 150 })
  name: string;

  @Column({ name: 'estimated_amount', type: 'decimal', precision: 15, scale: 2 })
  estimatedAmount: number;

  /** What it actually cost. Null while the line is still only a plan. */
  @Column({ name: 'actual_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  actualAmount: number | null;

  @Column()
  currency: string;

  /**
   * The month the money is expected to leave, `YYYY-MM`. Nullable because a
   * relocation has costs with no date yet — furniture is "somewhere after the
   * move" — and forcing a month would invent precision that does not exist.
   */
  @Column({ name: 'due_month', type: 'varchar', length: 7, nullable: true })
  dueMonth: string | null;

  @Column({
    type: 'enum',
    enum: GoalItemStatus,
    default: GoalItemStatus.PLANNED,
  })
  status: GoalItemStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /**
   * The transaction that paid for the line, linked from a receipt or a bank
   * row. Linking marks the line paid at the transaction's amount; unlinking
   * hands it back to the plan.
   */
  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: Relation<User | null>;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
