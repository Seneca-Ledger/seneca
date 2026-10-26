import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { CreditNote } from './credit-note.entity';
import { TaxRate } from './tax-rate.entity';

/** Same shape as an invoice line: the credit has to carry the tax rates back. */
@Entity('credit_note_line_items')
export class CreditNoteLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => CreditNote,
    creditNote => creditNote.lineItems,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'credit_note_id' })
  creditNote: Relation<CreditNote>;

  @Column({ name: 'credit_note_id', type: 'uuid' })
  creditNoteId: string;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2 })
  unitPrice: number;

  /** Unit of measure, as on the invoice line it credits. */
  @Column({ name: 'unit_code', type: 'varchar', length: 3, default: 'C62' })
  unitCode: string;

  /** Discount (negative) or surcharge (positive), as on the invoice line it credits. */
  @Column({ name: 'adjustment_percent', type: 'decimal', precision: 7, scale: 2, nullable: true })
  adjustmentPercent: number | null;

  @ManyToOne(() => TaxRate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tax_rate_id' })
  taxRate: Relation<TaxRate | null>;

  @Column({ name: 'tax_rate_id', type: 'uuid', nullable: true })
  taxRateId: string | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Relation<Category | null>;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
