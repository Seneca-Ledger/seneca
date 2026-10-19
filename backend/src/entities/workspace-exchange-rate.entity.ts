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
import { Workspace } from './workspace.entity';

/**
 * A rate a workspace entered by hand for one day. It wins over the provider's
 * rate for that day, in that workspace only: `exchange_rates` stays a shared
 * cache of provider quotes that no workspace can rewrite.
 */
@Entity('workspace_exchange_rates')
@Index(
  'UQ_workspace_exchange_rates_pair_day',
  ['workspaceId', 'baseCurrency', 'targetCurrency', 'rateDate'],
  {
    unique: true,
  },
)
export class WorkspaceExchangeRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'base_currency', type: 'varchar', length: 10 })
  baseCurrency: string;

  @Column({ name: 'target_currency', type: 'varchar', length: 10 })
  targetCurrency: string;

  @Column({ name: 'rate', type: 'decimal', precision: 18, scale: 8 })
  rate: number;

  @Column({ name: 'rate_date', type: 'date' })
  rateDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
