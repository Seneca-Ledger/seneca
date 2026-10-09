import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Workspace } from './workspace.entity';

/**
 * Next invoice number per workspace, taken by incrementing this row inside
 * the send transaction — same idea as `LedgerCounter`'s `next_entry_no`, so a
 * void'd or abandoned draft never leaves a gap because a number was never
 * assigned to it in the first place.
 */
@Entity('invoice_counters')
export class InvoiceCounter {
  @PrimaryColumn({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'prefix', type: 'varchar', length: 20, default: 'INV-' })
  prefix: string;

  /** bigint comes back from the driver as a string. */
  @Column({ name: 'next_invoice_no', type: 'bigint', default: 1 })
  nextInvoiceNo: string;

  @Column({ name: 'credit_note_prefix', type: 'varchar', length: 20, default: 'CN-' })
  creditNotePrefix: string;

  /** Its own sequence: a credit note is not an invoice. */
  @Column({ name: 'next_credit_note_no', type: 'bigint', default: 1 })
  nextCreditNoteNo: string;
}
