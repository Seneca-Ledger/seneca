import {
  AfterLoad,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

type JsonObject = Record<string, unknown>;

import { normalizeFilename } from '../common/utils/filename.util';
import { Category } from './category.entity';
import { Folder } from './folder.entity';
import { Tag } from './tag.entity';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum StatementStatus {
  UPLOADED = 'uploaded',
  PROCESSING = 'processing',
  PARSED = 'parsed',
  VALIDATED = 'validated',
  COMPLETED = 'completed',
  /**
   * Parsed, but the balance did not reconcile. Excluded from analytics until a
   * user confirms the discrepancy via `POST /statements/:id/confirm-balance`.
   */
  NEEDS_REVIEW = 'needs_review',
  ERROR = 'error',
}

/**
 * Where a statement sits in the review workflow (Submit → Approve → Pay).
 * Separate from `status`, which tracks parsing. Moves go through
 * `POST /statements/stage`, which enforces the allowed transitions.
 */
export enum StatementStage {
  SUBMIT = 'submit',
  APPROVE = 'approve',
  PAY = 'pay',
}

export enum BankName {
  BEREKE_NEW = 'bereke_new',
  BEREKE_OLD = 'bereke_old',
  KASPI = 'kaspi',
  HAPOALIM = 'hapoalim',
  OTHER = 'other',
}

export enum FileType {
  PDF = 'pdf',
  XLSX = 'xlsx',
  CSV = 'csv',
  IMAGE = 'image',
  DOCX = 'docx',
  /** Interchange formats banks export besides CSV; detected by extension and content. */
  OFX = 'ofx',
  QIF = 'qif',
  CAMT = 'camt',
  MT940 = 'mt940',
}

@Entity('statements')
export class Statement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => User,
    user => user.statements,
  )
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Folder, { nullable: true })
  @JoinColumn({ name: 'folder_id' })
  folder: Folder | null;

  @Column({ name: 'folder_id', type: 'uuid', nullable: true })
  folderId: string | null;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_path' })
  filePath: string;

  @Column({ name: 'file_data', type: 'bytea', nullable: true, select: false })
  fileData: Buffer | null;

  @Column({
    name: 'file_type',
    type: 'enum',
    enum: FileType,
  })
  fileType: FileType;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'file_hash' })
  fileHash: string;

  @Column({
    name: 'bank_name',
    type: 'enum',
    enum: BankName,
  })
  bankName: BankName;

  @Column({ name: 'account_number', nullable: true })
  accountNumber: string | null;

  @Column({ name: 'statement_date_from', type: 'date', nullable: true })
  statementDateFrom: Date | null;

  @Column({ name: 'statement_date_to', type: 'date', nullable: true })
  statementDateTo: Date | null;

  @Column({
    type: 'enum',
    enum: StatementStatus,
    default: StatementStatus.UPLOADED,
  })
  status: StatementStatus;

  @Column({
    type: 'enum',
    enum: StatementStage,
    enumName: 'statements_stage_enum',
    default: StatementStage.SUBMIT,
  })
  stage: StatementStage;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'total_transactions', default: 0 })
  totalTransactions: number;

  @Column({
    name: 'total_debit',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  totalDebit: number;

  @Column({
    name: 'total_credit',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  totalCredit: number;

  @Column({
    name: 'balance_start',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  balanceStart: number | null;

  @Column({
    name: 'balance_end',
    type: 'decimal',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  balanceEnd: number | null;

  @Column()
  currency: string;

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category | null;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'processed_at', nullable: true })
  processedAt: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @Column({ name: 'parsing_attempts', default: 0 })
  parsingAttempts: number;

  @Column({ name: 'parsing_details', type: 'jsonb', nullable: true })
  parsingDetails: {
    detectedBank?: string;
    detectedFormat?: string;
    detectedBy?: string;
    detectedEvidence?: string[];
    otherBankMentions?: string[];
    parserUsed?: string;
    parserVersion?: string;
    totalLinesProcessed?: number;
    transactionsFound?: number;
    transactionsCreated?: number;
    transactionsDeduplicated?: number;
    transactionsFlaggedDuplicate?: number;
    errors?: string[];
    warnings?: string[];
    metadataExtracted?: {
      accountNumber?: string;
      dateFrom?: string;
      dateTo?: string;
      balanceStart?: number;
      balanceEnd?: number;
      currency?: string;
      rawHeader?: string;
      normalizedHeader?: string;
      periodLabel?: string;
      institution?: string;
      locale?: string;
    };
    validation?: {
      passed: boolean;
      warnings: string[];
      balanceCheck?: {
        expectedEnd?: number;
        actualEnd?: number;
        difference?: number;
        tolerance?: number;
      };
    };
    droppedSamples?: Array<{
      reason: string;
      transaction?: JsonObject;
    }>;
    balanceConfirmation?: {
      confirmedBy: string;
      confirmedAt: string;
    };
    crossStatementDuplicates?: {
      groups: number;
      marked: number;
    };
    /** Transfer legs paired right after the import; see TransferPairingService. */
    transferPairs?: {
      found: number;
      paired: number;
    };
    importPreview?: JsonObject;
    importCommit?: JsonObject;
    processingTime?: number; // milliseconds
    logEntries?: Array<{ timestamp: string; level: string; message: string }>;
    manualCategorySelectionRequired?: boolean;
  } | null;

  // Relations
  @OneToMany(
    () => Transaction,
    transaction => transaction.statement,
  )
  transactions: Transaction[];

  @ManyToMany(
    () => Tag,
    tag => tag.statements,
    { cascade: true },
  )
  @JoinTable({
    name: 'statement_tags',
    joinColumn: { name: 'statement_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @AfterLoad()
  normalizeFileNameAfterLoad() {
    if (this.fileName) {
      this.fileName = normalizeFilename(this.fileName);
    }
  }
}
