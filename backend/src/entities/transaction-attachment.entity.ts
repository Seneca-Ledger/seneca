import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/**
 * A user-supplied file pinned to one transaction — the receipt photo or invoice
 * PDF that explains a statement row. Bytes live on disk under the uploads dir
 * (same as avatars); this row only carries the metadata.
 */
@Entity('transaction_attachments')
@Index('IDX_transaction_attachments_workspace_transaction', ['workspaceId', 'transactionId'])
export class TransactionAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Relation<Transaction>;

  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: Relation<User | null>;

  @Column({ name: 'uploaded_by_id', type: 'uuid', nullable: true })
  uploadedById: string | null;

  /** What the user called it. Display only — never used to build a path. */
  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  /** Generated name on disk. The only value allowed into a filesystem path. */
  @Column({ name: 'stored_file_name', type: 'varchar', length: 255 })
  storedFileName: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 127 })
  mimeType: string;

  @Column({ name: 'file_size', type: 'bigint' })
  fileSize: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
