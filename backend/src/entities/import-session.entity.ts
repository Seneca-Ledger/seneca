import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Statement } from './statement.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum ImportSessionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PREVIEW = 'preview',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ImportSessionMode {
  PREVIEW = 'preview',
  COMMIT = 'commit',
}

export type ImportConflictMatchType =
  | 'exact'
  | 'fuzzy_date'
  | 'fuzzy_amount'
  | 'fuzzy_text'
  | 'combined';

export type ImportConflictRecommendedAction =
  | 'keep_existing'
  | 'replace'
  | 'merge'
  | 'manual_review';

export type ImportConflictResolution = 'skip' | 'force_import' | 'mark_duplicate';

export interface ImportSessionPreviewClassification {
  index: number;
  status: 'new' | 'matched' | 'conflicted' | 'skipped' | 'failed';
  fingerprint?: string;
  existingTransactionId?: string;
  conflictConfidence?: number;
  conflictMatchType?: ImportConflictMatchType;
  conflictRecommendedAction?: ImportConflictRecommendedAction;
  error?: string;
  resolution?: ImportConflictResolution;
  /**
   * True when this row's fingerprint collides with an earlier row in the
   * SAME batch (not the database) — two distinct transactions the
   * fingerprint alone can't tell apart. Still committed as 'new' so nothing
   * is silently dropped, but persisted with isDuplicate=true so it doesn't
   * collide with the earlier row on the partial unique index.
   */
  duplicateInBatch?: boolean;
}

export interface ImportSessionRetryError {
  message: string;
  code: string;
  timestamp: string;
}

export interface ImportSessionRetryHistoryItem {
  attempt: number;
  timestamp: string;
  error: string;
}

export interface ImportSessionMetadata {
  totalTransactions: number;
  newCount: number;
  matchedCount: number;
  skippedCount: number;
  conflictedCount: number;
  failedCount: number;
  conflicts: Array<{
    transactionIndex: number;
    reason: string;
    confidence: number;
  }>;
  warnings: string[];
  errors: string[];
  previewData?: {
    classifications: ImportSessionPreviewClassification[];
  };
  retryCount?: number;
  lastRetryAt?: string | null;
  nextRetryAt?: string | null;
  lastError?: ImportSessionRetryError | null;
  retryHistory?: ImportSessionRetryHistoryItem[];
}

@Entity('import_sessions')
export class ImportSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => Statement, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'statement_id' })
  statement: Statement | null;

  @Column({ name: 'statement_id', type: 'uuid', nullable: true })
  statementId: string | null;

  @Column({
    type: 'enum',
    enum: ImportSessionStatus,
    default: ImportSessionStatus.PENDING,
  })
  status: ImportSessionStatus;

  @Column({
    type: 'enum',
    enum: ImportSessionMode,
  })
  mode: ImportSessionMode;

  @Column({ name: 'file_hash' })
  fileHash: string;

  @Column({ name: 'file_name' })
  fileName: string;

  @Column({ name: 'file_size' })
  fileSize: number;

  @Column({ name: 'session_metadata', type: 'jsonb', nullable: true })
  sessionMetadata: ImportSessionMetadata | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
