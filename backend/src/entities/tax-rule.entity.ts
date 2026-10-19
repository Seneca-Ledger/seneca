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
import { Workspace } from './workspace.entity';

export enum TaxRuleDirection {
  EXPENSE = 'expense',
  INCOME = 'income',
  BOTH = 'both',
}

/**
 * Maps a category to the rate that should apply to it.
 *
 * Rules point at a rate `code` rather than a rate row, because a code spans
 * every version of that rate. A rule written today keeps working after the law
 * changes: assignment resolves the code to whichever version was in force on
 * the transaction's own date.
 */
@Entity('tax_rules')
@Index(['workspaceId', 'isEnabled'])
export class TaxRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /** NULL makes the rule a catch-all for its direction. */
  @ManyToOne(() => Category, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  /** e.g. 'KZ_STANDARD'. Resolved to a version at the transaction's date. */
  @Column({ name: 'tax_rate_code', type: 'varchar', length: 40 })
  taxRateCode: string;

  /** Higher wins. Ties break towards the rule naming a category. */
  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ type: 'varchar', length: 20, default: TaxRuleDirection.BOTH })
  direction: TaxRuleDirection;

  @Column({ name: 'is_enabled', default: true })
  isEnabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
