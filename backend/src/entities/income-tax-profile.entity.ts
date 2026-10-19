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
import type { TaxpayerType } from '../modules/income-tax/rule-packs/types';
import { Workspace } from './workspace.entity';

/**
 * Who files, for one workspace and tax year.
 *
 * The country is not stored here: it is the workspace's tax jurisdiction, and a
 * second copy could disagree with it. The form is not stored either — it
 * follows from country, year and taxpayer type, so it cannot drift from them.
 */
@Entity('income_tax_profiles')
@Index('UQ_income_tax_profiles_year', ['workspaceId', 'taxYear'], { unique: true })
export class IncomeTaxProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'tax_year', type: 'smallint' })
  taxYear: number;

  @Column({ name: 'taxpayer_type', type: 'varchar', length: 20 })
  taxpayerType: TaxpayerType;

  /** Pack-specific answers (activity key, home-office days…), read by the pack. */
  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  details: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
