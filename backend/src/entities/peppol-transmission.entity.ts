import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { CreditNote } from './credit-note.entity';
import { Invoice } from './invoice.entity';
import { Workspace } from './workspace.entity';

export type PeppolFormat = 'peppol_bis' | 'xrechnung_cii';
export type PeppolDeliveryStatus = 'pending' | 'delivered' | 'failed';

/**
 * One invoice or credit note sent over Peppol. At most one that has not
 * failed per document (partial unique indexes in the migration), so a
 * double click cannot put the same invoice on the network twice.
 */
@Entity('peppol_transmissions')
@Index('IDX_peppol_transmissions_workspace_status', ['workspaceId', 'status'])
export class PeppolTransmission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Relation<Invoice | null>;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => CreditNote, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'credit_note_id' })
  creditNote: Relation<CreditNote | null>;

  @Column({ name: 'credit_note_id', type: 'uuid', nullable: true })
  creditNoteId: string | null;

  /** The recipient's Peppol id. */
  @Column({ type: 'varchar', length: 100 })
  recipient: string;

  @Column({ type: 'varchar', length: 20 })
  format: PeppolFormat;

  @Column({ name: 'doc_type_id', type: 'text' })
  docTypeId: string;

  /** The access point's id for the document, to follow its delivery. */
  @Column({ name: 'provider_document_id', type: 'varchar', length: 100, nullable: true })
  providerDocumentId: string | null;

  /** The document exactly as it was sent: the e-invoice to keep (GoBD). */
  @Column({ name: 'document_xml', type: 'text', select: false })
  documentXml: string;

  @Column({ type: 'varchar', length: 20 })
  status: PeppolDeliveryStatus;

  @Column({ type: 'text', nullable: true })
  failure: string | null;

  @Column({ name: 'sent_by_id', type: 'uuid', nullable: true })
  sentById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
