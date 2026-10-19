import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/**
 * A savings goal. How much has been put aside is never stored on the goal —
 * it is the sum of its contributions, computed on read, so the number cannot
 * drift away from the log it is supposed to summarise (see
 * .claude/rules/database.md on deriving balances from an immutable log).
 */
@Entity('goals')
@Index('IDX_goals_workspace_created', ['workspaceId', 'createdAt'])
export class Goal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ length: 150 })
  name: string;

  @Column({ name: 'target_amount', type: 'decimal', precision: 15, scale: 2 })
  targetAmount: number;

  @Column()
  currency: string;

  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate: string | null;

  /**
   * The goal's picture. Exactly one of these is set: `coverPreset` names a
   * bundled tile the client draws itself, `coverFile` names a photo copied
   * into the uploads directory. The attribution pair belongs to the photo —
   * a CC-BY image may not be shown without naming its author and licence.
   */
  @Column({ name: 'cover_preset', type: 'varchar', length: 40, nullable: true })
  coverPreset: string | null;

  @Column({ name: 'cover_file', type: 'varchar', length: 120, nullable: true })
  coverFile: string | null;

  @Column({ name: 'cover_attribution', type: 'varchar', length: 400, nullable: true })
  coverAttribution: string | null;

  @Column({ name: 'cover_source_url', type: 'varchar', length: 500, nullable: true })
  coverSourceUrl: string | null;

  @OneToMany(
    () => GoalContribution,
    contribution => contribution.goal,
  )
  contributions: GoalContribution[];

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}

/**
 * One movement toward a goal. Deposits are positive, withdrawals negative —
 * a contribution is never edited or reversed in place, the correction is
 * another row.
 */
@Entity('goal_contributions')
@Index('IDX_goal_contributions_goal_date', ['goalId', 'contributionDate'])
export class GoalContribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => Goal,
    goal => goal.contributions,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'goal_id' })
  goal: Goal;

  @Column({ name: 'goal_id', type: 'uuid' })
  goalId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ name: 'contribution_date', type: 'date' })
  contributionDate: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
