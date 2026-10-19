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
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum IncomeTaxReturnStatus {
  /** Nothing frozen; the draft is recomputed from current data on every read. */
  DRAFT = 'draft',
  /** The user has taken these figures to file; the snapshot is what they took. */
  FINALIZED = 'finalized',
}

/**
 * A finalized income-tax draft.
 *
 * Unlike VAT returns this does not lock transactions: `taxLocked` belongs to
 * the VAT return, and reopening a VAT period would silently unlock rows this
 * record relies on. The snapshot is the record instead — it holds every figure,
 * every contributing transaction, the completeness score and the disclaimer
 * version the user had accepted.
 */
@Entity('income_tax_returns')
@Index('UQ_income_tax_returns_year', ['workspaceId', 'taxYear', 'formKey'], { unique: true })
export class IncomeTaxReturn {
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

  @Column({ name: 'tax_year', type: 'smallint' })
  taxYear: number;

  @Column({ name: 'form_key', type: 'varchar', length: 64 })
  formKey: string;

  @Column({ type: 'varchar', length: 20, default: IncomeTaxReturnStatus.DRAFT })
  status: IncomeTaxReturnStatus;

  @Column({ name: 'finalized_at', type: 'timestamptz', nullable: true })
  finalizedAt: Date | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'finalized_by' })
  finalizer: User | null;

  @Column({ name: 'finalized_by', type: 'uuid', nullable: true })
  finalizedBy: string | null;

  /** The full draft as it stood when finalized. Shape: `IncomeTaxDraft`. */
  @Column({ type: 'jsonb', nullable: true })
  snapshot: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
