import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InvestmentHolding, type InvestmentMetal } from './investment-holding.entity';
import { Workspace } from './workspace.entity';

/**
 * Metal that left the stack. The row carries its own cost basis because the
 * lot it came from may be gone: a lot sold out completely is deleted, and the
 * sale keeps the realized result.
 */
@Entity('metal_sales')
@Index('IDX_metal_sales_workspace_sold_on', ['workspaceId', 'soldOn'])
export class MetalSale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => InvestmentHolding, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'lot_id' })
  lot: InvestmentHolding | null;

  @Column({ name: 'lot_id', type: 'uuid', nullable: true })
  lotId: string | null;

  @Column({ type: 'enum', enum: ['XAU', 'XAG', 'XPT', 'XPD'], enumName: 'investment_metal_enum' })
  metal: InvestmentMetal;

  /** What the lot was called when it was sold; the lot itself may be gone. */
  @Column({ name: 'lot_name', length: 255 })
  lotName: string;

  /** Pieces sold out of the lot. */
  @Column({ type: 'decimal', precision: 24, scale: 8 })
  quantity: number;

  @Column({ name: 'fine_ounces', type: 'decimal', precision: 24, scale: 8 })
  fineOunces: number;

  /** Zero for a gift: metal that left for nothing is still metal that left. */
  @Column({ type: 'decimal', precision: 20, scale: 6, default: 0 })
  proceeds: number;

  @Column({ name: 'proceeds_currency', length: 10 })
  proceedsCurrency: string;

  /** The share of the lot's cost this sale took away; null when the lot had no cost. */
  @Column({ name: 'cost_basis', type: 'decimal', precision: 20, scale: 6, nullable: true })
  costBasis: number | null;

  @Column({ name: 'cost_currency', length: 10, nullable: true })
  costCurrency: string | null;

  @Column({ name: 'sold_on', type: 'date' })
  soldOn: string;

  /**
   * The day the sold pieces were bought, copied from the lot. A holding period
   * cannot be read off a lot that the sale itself deleted.
   */
  @Column({ name: 'acquired_on', type: 'date', nullable: true })
  acquiredOn: string | null;

  /** Whose sale it was; a return belongs to a person, not to a workspace. */
  @Column({ name: 'owner_user_id', type: 'uuid', nullable: true })
  ownerUserId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  counterparty: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
