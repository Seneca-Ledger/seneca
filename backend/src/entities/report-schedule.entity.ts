import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum ReportScheduleCadence {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * A recurring report delivered by email. The reporting period is derived from
 * the cadence at run time (the last completed day/week/month), so a schedule
 * never has to store a moving date range.
 */
@Entity('report_schedules')
export class ReportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /** Owner of the schedule; also whose SMTP settings and locale are used. */
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'template_id' })
  templateId: string;

  @Column()
  format: string;

  @Column({ type: 'varchar' })
  cadence: ReportScheduleCadence;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  recipients: string[];

  @Column({ name: 'wallet_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  walletIds: string[];

  @Column({ name: 'category_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  categoryIds: string[];

  @Column({ name: 'group_by', type: 'varchar', nullable: true })
  groupBy: string | null;

  @Column({ type: 'varchar', nullable: true })
  locale: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_run_at', type: 'timestamptz', nullable: true })
  lastRunAt: Date | null;

  /** Due when this is in the past. Advanced after every successful send. */
  @Column({ name: 'next_run_at', type: 'timestamptz' })
  nextRunAt: Date;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
