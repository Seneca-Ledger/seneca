import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from './category.entity';
import { Invoice } from './invoice.entity';
import { TaxRate } from './tax-rate.entity';

@Entity('invoice_line_items')
export class InvoiceLineItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => Invoice,
    invoice => invoice.lineItems,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ type: 'varchar', length: 500 })
  description: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 15, scale: 2 })
  unitPrice: number;

  /** Unit of measure, UN/ECE Recommendation 20: C62 one, HUR hour, DAY day, MON month… */
  @Column({ name: 'unit_code', type: 'varchar', length: 3, default: 'C62' })
  unitCode: string;

  /**
   * Discount (negative) or surcharge (positive) on quantity × unit price, in
   * percent. NULL is neither.
   */
  @Column({ name: 'adjustment_percent', type: 'decimal', precision: 7, scale: 2, nullable: true })
  adjustmentPercent: number | null;

  @ManyToOne(() => TaxRate, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tax_rate_id' })
  taxRate: TaxRate | null;

  @Column({ name: 'tax_rate_id', type: 'uuid', nullable: true })
  taxRateId: string | null;

  /** Which income account the line's revenue books to; falls back to a generic sales account. */
  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
