import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TaxJurisdiction } from './tax-jurisdiction.entity';
import { TaxRateKind } from './tax-jurisdiction-rate.entity';
import { Workspace } from './workspace.entity';

/**
 * A workspace's active rate set.
 *
 * Rows are versioned exactly like the statutory catalogue they are adopted
 * from: a rate that changes gets a `validTo` and a successor row, never an
 * in-place edit. Transactions point at a specific version, so a rate change
 * cannot retroactively rewrite tax that has already been assessed.
 *
 * Rates a user typed in by hand have `code` and `jurisdictionId` NULL and are
 * left alone when a jurisdiction is adopted or switched.
 */
@Entity('tax_rates')
export class TaxRate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  rate: number;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @Column({ name: 'is_enabled', default: true })
  isEnabled: boolean;

  /** Set when this rate was adopted from a jurisdiction rather than typed in. */
  @ManyToOne(() => TaxJurisdiction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'jurisdiction_id' })
  jurisdiction: TaxJurisdiction | null;

  @Column({ name: 'jurisdiction_id', type: 'uuid', nullable: true })
  jurisdictionId: string | null;

  /**
   * Stable identity shared by every version of the same rate, e.g. 'KZ_STANDARD'.
   * NULL for hand-made rates, which have no statutory lineage to track.
   */
  @Column({ type: 'varchar', length: 40, nullable: true })
  code: string | null;

  @Column({ type: 'varchar', length: 20, default: TaxRateKind.STANDARD })
  kind: TaxRateKind;

  /** '1900-01-01' means "since before we care", so range queries need no NULL case. */
  @Column({ name: 'valid_from', type: 'date', default: '1900-01-01' })
  validFrom: string;

  /** NULL means still in force. */
  @Column({ name: 'valid_to', type: 'date', nullable: true })
  validTo: string | null;

  /**
   * Whether amounts taxed at this rate already contain the tax. Bank statements
   * and receipts are gross, so this defaults to true.
   */
  @Column({ name: 'is_inclusive', default: true })
  isInclusive: boolean;

  /** Cross-border B2B: tax is accounted for by the buyer, so nothing is charged. */
  @Column({ name: 'is_reverse_charge', default: false })
  isReverseCharge: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
