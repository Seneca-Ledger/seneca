import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from './client.entity';
import { InvoiceLineItem } from './invoice-line-item.entity';
import { Workspace } from './workspace.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  /**
   * Derived, never stored: part of the money has arrived. The column holds
   * 'sent' and the receivable's payments decide the rest.
   */
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERDUE = 'overdue',
  VOID = 'void',
}

export enum InvoiceRecurrenceInterval {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

/**
 * A bill sent to a client. Line items carry the money; the totals here are a
 * cache recomputed from them on every draft save, never edited directly.
 *
 * Sending an invoice is the one moment that matters for money: it assigns the
 * gap-free `invoiceNumber`, generates the PDF, opens a receivable `Payable` so
 * it is chased and paid like any other bill, and books an accrual journal
 * entry (Dr Accounts Receivable / Cr Revenue) via `payableId`/`journalEntryId`.
 * Before that an invoice is just a draft and touches neither books.
 */
@Entity('invoices')
@Index('IDX_invoices_workspace_status', ['workspaceId', 'status'])
@Index('IDX_invoices_workspace_client', ['workspaceId', 'clientId'])
@Index('IDX_invoices_workspace_recurring', ['workspaceId', 'isRecurring', 'nextIssueDate'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Client, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'client_id' })
  client: Client;

  @Column({ name: 'client_id', type: 'uuid' })
  clientId: string;

  /** Assigned at `sent`; NULL while a draft. */
  @Column({ name: 'invoice_number', type: 'varchar', length: 40, nullable: true })
  invoiceNumber: string | null;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
  })
  status: InvoiceStatus;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  /**
   * Whether a line's unit price already contains its tax.
   *
   * Off by default: a seller quoting a unit price normally means the net
   * amount, and `subtotal` stays the figure the tax is added to. On, the price
   * is the gross figure and the tax is extracted from it — which is how retail
   * prices and most consumer invoices are written.
   */
  @Column({ name: 'prices_include_tax', type: 'boolean', default: false })
  pricesIncludeTax: boolean;

  /** Net of tax, whichever way the prices are quoted. */
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'tax_total', type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxTotal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** The receivable this invoice opened at `sent`; carries its due-tracking and payment. */
  @Column({ name: 'payable_id', type: 'uuid', nullable: true })
  payableId: string | null;

  /** The accrual entry booked at `sent`. */
  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string | null;

  /**
   * The secret in the link the client opens. Minted when the invoice is sent;
   * NULL on a draft, which has nothing to show yet.
   */
  @Column({ name: 'share_token', type: 'varchar', length: 64, nullable: true, unique: true })
  shareToken: string | null;

  /** When the client first opened the link — "did they even see it". */
  @Column({ name: 'viewed_at', type: 'timestamptz', nullable: true })
  viewedAt: Date | null;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @Column({ name: 'file_data', type: 'bytea', nullable: true, select: false })
  fileData: Buffer | null;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ name: 'file_hash', type: 'varchar', length: 64, nullable: true })
  fileHash: string | null;

  @Column({ name: 'is_recurring', type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({
    name: 'recurrence_interval',
    type: 'enum',
    enum: InvoiceRecurrenceInterval,
    nullable: true,
  })
  recurrenceInterval: InvoiceRecurrenceInterval | null;

  /** When the scheduler should next clone this template into a draft copy. */
  @Column({ name: 'next_issue_date', type: 'date', nullable: true })
  nextIssueDate: string | null;

  @Column({ name: 'recurrence_end_date', type: 'date', nullable: true })
  recurrenceEndDate: string | null;

  /** Set on a generated copy; NULL on the recurring template itself. */
  @Column({ name: 'source_recurring_invoice_id', type: 'uuid', nullable: true })
  sourceRecurringInvoiceId: string | null;

  /** Dunning: how many reminder emails went to the client, and when the last one did. */
  @Column({ name: 'reminder_count', type: 'int', default: 0 })
  reminderCount: number;

  @Column({ name: 'last_reminder_at', type: 'timestamptz', nullable: true })
  lastReminderAt: Date | null;

  @OneToMany(
    () => InvoiceLineItem,
    lineItem => lineItem.invoice,
  )
  lineItems: InvoiceLineItem[];

  /**
   * Read models only, filled from the receivable's payments: what has arrived
   * and what is still open. Never columns — the payment log is the truth.
   */
  amountPaid?: number;
  /** Taken back by credit notes; not owed and never paid. */
  amountCredited?: number;
  amountDue?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
