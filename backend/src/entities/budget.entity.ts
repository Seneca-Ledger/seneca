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
import { Category } from './category.entity';
import { Goal } from './goal.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum BudgetPeriodType {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

/**
 * What happens to the unspent part of a period.
 * - none: every period starts at the limit (how budgets always behaved);
 * - carry: leftover and overspend move into the next period without a cap,
 *   the envelope for irregular costs such as car repairs;
 * - refill: leftover tops the budget back up to the limit and never above it,
 *   overspend still dents the next period ("refill up to").
 */
export enum BudgetRolloverMode {
  NONE = 'none',
  CARRY = 'carry',
  REFILL = 'refill',
}

/**
 * One category may now carry several limits of the same period, as long as at
 * most one of them is unattached: the household grocery budget and the "food
 * during the move" budget are different intents over the same category, and a
 * single unique key across (workspace, category, period) made the second one
 * impossible to create.
 *
 * Two partial unique indexes rather than one key over four columns, because in
 * Postgres NULLs never collide — a plain unique key including `goal_id` would
 * silently allow any number of unattached duplicates, which is the case the
 * original constraint existed to prevent.
 */
@Entity('budgets')
@Index(
  'UQ_budgets_workspace_category_period_unlinked',
  ['workspaceId', 'categoryId', 'periodType'],
  {
    unique: true,
    where: '"goal_id" IS NULL',
  },
)
@Index(
  'UQ_budgets_workspace_category_period_goal',
  ['workspaceId', 'categoryId', 'periodType', 'goalId'],
  { unique: true, where: '"goal_id" IS NOT NULL' },
)
@Index('IDX_budgets_workspace_category', ['workspaceId', 'categoryId'])
@Index('IDX_budgets_workspace_goal', ['workspaceId', 'goalId'])
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Category, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'limit_amount', type: 'decimal', precision: 15, scale: 2 })
  limitAmount: number;

  @Column()
  currency: string;

  @Column({
    name: 'period_type',
    type: 'enum',
    enum: BudgetPeriodType,
  })
  periodType: BudgetPeriodType;

  @Column({
    name: 'rollover_mode',
    type: 'enum',
    enum: BudgetRolloverMode,
    enumName: 'budgets_rollover_mode_enum',
    default: BudgetRolloverMode.NONE,
  })
  rolloverMode: BudgetRolloverMode;

  @Column({ name: 'alert_at_80_sent', default: false })
  alertAt80Sent: boolean;

  @Column({ name: 'alert_at_100_sent', default: false })
  alertAt100Sent: boolean;

  @Column({ name: 'current_period_start', type: 'date' })
  currentPeriodStart: Date;

  /**
   * The window the budget is meant to apply in. Both null — the norm — means it
   * runs forever, which is how every budget behaved before these columns
   * existed. A project budget is the reason they exist: the relocation's moving
   * costs run February to August and should stop counting, and stop alerting,
   * outside that.
   *
   * Spending is clamped to this window rather than the budget simply
   * disappearing, so a budget that started mid-month reports the part of the
   * month it actually governs.
   */
  @Column({ name: 'starts_on', type: 'date', nullable: true })
  startsOn: string | null;

  @Column({ name: 'ends_on', type: 'date', nullable: true })
  endsOn: string | null;

  /**
   * The goal this limit serves, if any. Null is the norm — a budget is useful
   * on its own, and attaching it to a goal is what turns the pair into a
   * plan-versus-actual tree. Goals are soft-deleted, so the FK's SET NULL will
   * not fire on the usual delete path: readers must still exclude archived
   * goals themselves.
   */
  @ManyToOne(() => Goal, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'goal_id' })
  goal: Goal | null;

  @Column({ name: 'goal_id', type: 'uuid', nullable: true })
  goalId: string | null;

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
