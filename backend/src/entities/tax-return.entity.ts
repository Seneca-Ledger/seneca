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
import { TaxJurisdiction } from './tax-jurisdiction.entity';
import { Workspace } from './workspace.entity';

export enum TaxReturnStatus {
  /** Recomputed from the transactions on every read. */
  DRAFT = 'draft',
  /** Submitted. Frozen, and its transactions are locked. */
  FILED = 'filed',
}

/** One line of the snapshot: what a transaction contributed, when it was filed. */
export interface TaxReturnSnapshotLine {
  transactionId: string;
  date: string;
  counterparty: string;
  /** `reverse_charge` lines are reported on both sides and cancel. */
  direction: 'output' | 'input' | 'reverse_charge';
  currency: string;
  taxAmount: number;
  netAmount: number;
  /** Rate used to bring `taxAmount` into the return's currency. */
  exchangeRate: number;
  taxAmountConverted: number;
}

@Entity('tax_returns')
@Index(['workspaceId', 'periodStart'])
export class TaxReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => TaxJurisdiction, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'jurisdiction_id' })
  jurisdiction: TaxJurisdiction;

  @Column({ name: 'jurisdiction_id', type: 'uuid' })
  jurisdictionId: string;

  @Column({ name: 'period_start', type: 'date' })
  periodStart: string;

  @Column({ name: 'period_end', type: 'date' })
  periodEnd: string;

  @Column({ type: 'varchar', length: 20, default: TaxReturnStatus.DRAFT })
  status: TaxReturnStatus;

  /** Tax charged on income. */
  @Column({ name: 'output_tax', type: 'decimal', precision: 15, scale: 2, default: 0 })
  outputTax: number;

  /** Tax paid on expenses and reclaimable. */
  @Column({ name: 'input_tax', type: 'decimal', precision: 15, scale: 2, default: 0 })
  inputTax: number;

  /** output − input. Negative means a refund is due. */
  @Column({ name: 'net_payable', type: 'decimal', precision: 15, scale: 2, default: 0 })
  netPayable: number;

  /** The jurisdiction's currency, which is what the return is filed in. */
  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ name: 'filed_at', type: 'timestamptz', nullable: true })
  filedAt: Date | null;

  /**
   * Line-by-line record taken at the moment of filing.
   *
   * Without it, reopening a return filed six months ago would recompute it from
   * transactions that have since been edited, and show different figures than
   * the ones actually submitted.
   */
  @Column({ type: 'jsonb', nullable: true })
  snapshot: TaxReturnSnapshotLine[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
