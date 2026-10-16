import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Receipt } from './receipt.entity';
import { Workspace } from './workspace.entity';

/**
 * A document received over Peppol and taken in as a receipt. The unique key
 * keeps a document that was taken in, but not yet marked read at the access
 * point, from coming in twice.
 */
@Entity('peppol_inbound_documents')
@Unique('UQ_peppol_inbound_documents_workspace_document', ['workspaceId', 'providerDocumentId'])
export class PeppolInboundDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'provider_document_id', type: 'varchar', length: 100 })
  providerDocumentId: string;

  @Column({ name: 'sender_peppol_id', type: 'varchar', length: 100, nullable: true })
  senderPeppolId: string | null;

  @ManyToOne(() => Receipt, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'receipt_id' })
  receipt: Receipt | null;

  @Column({ name: 'receipt_id', type: 'uuid', nullable: true })
  receiptId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
