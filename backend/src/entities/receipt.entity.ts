import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { EInvoiceSummary } from '../modules/e-invoices/einvoice-summary';
import { StatementStage } from './statement.entity';
import { Tag } from './tag.entity';
import { Transaction, type TransactionCategorySource } from './transaction.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum ReceiptStatus {
  NEW = 'new',
  PARSED = 'parsed',
  NEEDS_REVIEW = 'needs_review',
  DRAFT = 'draft',
  REVIEWED = 'reviewed',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  FAILED = 'failed',
}

export enum ReceiptSource {
  UPLOAD = 'upload',
  TELEGRAM = 'telegram',
  SCAN = 'scan',
  IMAP = 'imap',
  /** An e-invoice received over the Peppol network. */
  PEPPOL = 'peppol',
}

/** Where a receipt's point on the map came from, in the order auto-detection trusts them. */
export enum ReceiptLocationSource {
  MERCHANT_ADDRESS = 'merchant_address',
  EXIF = 'exif',
  DEVICE = 'device',
  MANUAL = 'manual',
  /** Reserved for the tax-authority QR lookup; nothing writes it yet. */
  FISCAL_QR = 'fiscal_qr',
  /** A shop the user picked from the places near them; details in metadata.place. */
  PLACE = 'place',
}

@Entity('receipts')
@Index(['userId'])
@Index('IDX_receipts_workspace_received_at', ['workspaceId', 'receivedAt'])
@Index(['status'])
@Index('IDX_receipts_workspace_message_id_unique', ['workspaceId', 'messageId'], {
  unique: true,
  where: '"message_id" IS NOT NULL',
})
@Index(['receivedAt'])
@Index(['duplicateOfId'])
@Index(['isDuplicate'])
export class Receipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({
    name: 'source',
    type: 'enum',
    enum: ReceiptSource,
    default: ReceiptSource.UPLOAD,
  })
  source: ReceiptSource;

  /** The source's own message key (IMAP); unique per workspace. */
  @Column({ type: 'varchar', name: 'message_id', nullable: true })
  messageId: string | null;

  @Column()
  subject: string;

  @Column()
  sender: string;

  @Column({ name: 'received_at', type: 'timestamp' })
  receivedAt: Date;

  @Column({
    type: 'enum',
    enum: ReceiptStatus,
    default: ReceiptStatus.DRAFT,
  })
  status: ReceiptStatus;

  /**
   * Review-workflow stage, shared with statements (Submit → Approve). Separate
   * from `status`, which tracks parsing and approval into a transaction. Moves go
   * through `POST /receipts/stage`.
   */
  @Column({
    type: 'enum',
    enum: StatementStage,
    enumName: 'receipts_stage_enum',
    default: StatementStage.SUBMIT,
  })
  stage: StatementStage;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    attachments?: Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
    }>;
    labels?: string[];
    snippet?: string;
    potentialDuplicates?: string[];
    /**
     * The bank row(s) this receipt most likely documents, found after parsing.
     * Approve attaches to them instead of booking the expense a second time.
     */
    transactionMatch?: {
      transactionIds: string[];
      kind: 'single' | 'multi';
      score: number;
      computedAt: string;
    } | null;
    /**
     * Raw point captured with the photo, kept apart from the resolved location
     * so a reset to automatic can recompute without the upload request.
     */
    captureLocation?: {
      lat: number;
      lng: number;
      accuracyM?: number;
      source: 'exif' | 'device';
      capturedAt: string;
    };
    /** The OpenStreetMap place behind a PLACE location. */
    place?: {
      name: string;
      category: string | null;
      osmType: string;
      osmId: string;
    };
  };

  @Column({ type: 'jsonb', nullable: true, name: 'parsed_data' })
  parsedData: {
    amount?: number;
    currency?: string;
    vendor?: string;
    merchantAddress?: string;
    date?: string;
    category?: string;
    categoryId?: string;
    /** Which step picked `categoryId`, carried onto the transaction the receipt books. */
    categorySource?: TransactionCategorySource | null;
    categoryReason?: string | null;
    tax?: number;
    taxRate?: number;
    subtotal?: number;
    lineItems?: Array<{
      description: string;
      amount: number;
      /** Set by the line-item split; the category this line was booked under. */
      categoryId?: string | null;
    }>;
    transactionType?: 'income' | 'expense' | 'transfer' | 'unknown';
    confidence?: number;
    validationIssues?: string[];
    /** Set when the file is a structured e-invoice: what its XML says beyond the fields above. */
    einvoice?: EInvoiceSummary;
  };

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'language' })
  language: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, name: 'extraction_method' })
  extractionMethod: string | null;

  @Column({ type: 'numeric', precision: 3, scale: 2, nullable: true, name: 'confidence' })
  confidence: number | null;

  @Column({ type: 'text', array: true, nullable: true, name: 'attachment_paths' })
  attachmentPaths: string[];

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @ManyToOne(() => Transaction, { nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction | null;

  @Column({ name: 'statement_id', type: 'uuid', nullable: true })
  statementId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'tax_amount' })
  taxAmount: number | null;

  @Column({ name: 'duplicate_of_id', type: 'uuid', nullable: true })
  duplicateOfId: string | null;

  @ManyToOne(() => Receipt, { nullable: true })
  @JoinColumn({ name: 'duplicate_of_id' })
  duplicateOf: Receipt | null;

  @Column({ name: 'is_duplicate', type: 'boolean', default: false })
  isDuplicate: boolean;

  @Column({ name: 'location_lat', type: 'double precision', nullable: true })
  locationLat: number | null;

  @Column({ name: 'location_lng', type: 'double precision', nullable: true })
  locationLng: number | null;

  @Column({ name: 'location_source', type: 'varchar', length: 32, nullable: true })
  locationSource: ReceiptLocationSource | null;

  @Column({ name: 'location_accuracy_m', type: 'integer', nullable: true })
  locationAccuracyM: number | null;

  @Column({ name: 'location_updated_at', type: 'timestamptz', nullable: true })
  locationUpdatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToMany(
    () => Tag,
    tag => tag.receipts,
  )
  @JoinTable({
    name: 'receipt_tags',
    joinColumn: { name: 'receipt_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];
}
