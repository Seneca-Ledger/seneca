import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { CreditNote } from './credit-note.entity';
import { Invoice } from './invoice.entity';
import { Workspace } from './workspace.entity';

/**
 * How much of a credit note lands on one invoice.
 *
 * One note may cover several invoices — the client who was overcharged across
 * three of them gets one document, not three — so the amount lives here and
 * not on the note.
 */
@Entity('credit_note_applications')
@Unique('UQ_credit_note_applications_note_invoice', ['creditNoteId', 'invoiceId'])
@Index('IDX_credit_note_applications_invoice', ['invoiceId'])
export class CreditNoteApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => CreditNote,
    creditNote => creditNote.applications,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'credit_note_id' })
  creditNote: CreditNote;

  @Column({ name: 'credit_note_id', type: 'uuid' })
  creditNoteId: string;

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

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
