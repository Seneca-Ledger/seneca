import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Invoice } from './invoice.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum InvoiceDeliveryChannel {
  EMAIL = 'email',
}

export enum InvoiceDeliveryStatus {
  SENT = 'sent',
  /** SMTP is not configured for this workspace, so nothing was attempted. */
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

/**
 * Every attempt to put an invoice in front of its client.
 *
 * Kept because "did it actually go out, and where to" is the question behind
 * the loudest complaint about invoicing tools: mail that silently lands in
 * spam, or never leaves at all, while the sender waits to be paid. One row per
 * attempt, including the failures, so the card can say what happened instead of
 * showing a hopeful "sent".
 */
@Entity('invoice_deliveries')
@Index('IDX_invoice_deliveries_invoice', ['invoiceId', 'createdAt'])
export class InvoiceDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /** Who pressed send; NULL once that account is gone. */
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sent_by_id' })
  sentBy: User | null;

  @Column({ name: 'sent_by_id', type: 'uuid', nullable: true })
  sentById: string | null;

  @Column({ type: 'varchar', length: 16, default: InvoiceDeliveryChannel.EMAIL })
  channel: InvoiceDeliveryChannel;

  /** The address it went to, as it was at the time. */
  @Column({ type: 'varchar', length: 255 })
  recipient: string;

  @Column({ type: 'varchar', length: 16 })
  status: InvoiceDeliveryStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  subject: string | null;

  /** The SMTP error, for the card to show instead of a silent failure. */
  @Column({ type: 'text', nullable: true })
  error: string | null;

  /**
   * Which scheduled reminder this was, in days from the due date; NULL when a
   * person pressed send. Unique per invoice, so a reminder cannot go out twice
   * however often the scheduler runs.
   */
  @Column({ name: 'reminder_offset', type: 'int', nullable: true })
  reminderOffset: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
