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
import { CreditNoteApplication } from './credit-note-application.entity';
import { CreditNoteLineItem } from './credit-note-line-item.entity';
import { Workspace } from './workspace.entity';

export enum CreditNoteStatus {
  ISSUED = 'issued',
  VOID = 'void',
}

/**
 * Money taken back off an invoice the client already has.
 *
 * It is a document in its own right: its own gap-free number, its own lines so
 * the tax splits per rate, a journal entry that is the mirror of the invoice's
 * accrual (Dr Revenue, Dr VAT / Cr Receivables), and one or more applications
 * that lower what is owed on the invoices it covers.
 *
 * There is no draft: a credit note is raised against invoices that exist, with
 * amounts those invoices can carry, so there is nothing to keep unissued.
 */
@Entity('credit_notes')
@Index('IDX_credit_notes_workspace_client', ['workspaceId', 'clientId'])
export class CreditNote {
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

  @Column({ name: 'credit_note_number', type: 'varchar', length: 40, nullable: true })
  creditNoteNumber: string | null;

  @Column({ type: 'enum', enum: CreditNoteStatus, default: CreditNoteStatus.ISSUED })
  status: CreditNoteStatus;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate: string;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  /** Copied from the invoices it credits, so the lines price the same way. */
  @Column({ name: 'prices_include_tax', type: 'boolean', default: false })
  pricesIncludeTax: boolean;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'tax_total', type: 'decimal', precision: 15, scale: 2, default: 0 })
  taxTotal: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  total: number;

  /** Why the money is going back — printed on the document. */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string | null;

  @Column({ name: 'file_data', type: 'bytea', nullable: true, select: false })
  fileData: Buffer | null;

  @Column({ name: 'file_size', type: 'int', nullable: true })
  fileSize: number | null;

  @Column({ name: 'file_hash', type: 'varchar', length: 64, nullable: true })
  fileHash: string | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @OneToMany(
    () => CreditNoteLineItem,
    lineItem => lineItem.creditNote,
  )
  lineItems: CreditNoteLineItem[];

  @OneToMany(
    () => CreditNoteApplication,
    application => application.creditNote,
  )
  applications: CreditNoteApplication[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
