import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum WorkspaceVersionTrigger {
  MANUAL = 'manual',
  SCHEDULED = 'scheduled',
}

export enum WorkspaceVersionStatus {
  RUNNING = 'running',
  READY = 'ready',
  FAILED = 'failed',
}

/**
 * A workspace as it was at `takenAt`: its rows (an encrypted payload) and its
 * documents, both kept in the version store by hash. Opening one rebuilds it
 * as a read-only workspace.
 */
@Entity('workspace_versions')
@Index('IDX_workspace_versions_workspace_taken', ['workspaceId', 'takenAt'])
export class WorkspaceVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @Column({ name: 'taken_at', type: 'timestamptz', default: () => 'now()' })
  takenAt: Date;

  @Column({ type: 'varchar', length: 16 })
  trigger: WorkspaceVersionTrigger;

  @Column({ type: 'varchar', length: 16 })
  status: WorkspaceVersionStatus;

  /** The owner's calendar day a nightly version is for; null for a manual one. */
  @Column({ name: 'scheduled_for', type: 'date', nullable: true })
  scheduledFor: string | null;

  /** sha256 of the plain rows: equal on a day nothing changed. */
  @Column({ name: 'payload_sha256', type: 'varchar', length: 64, nullable: true })
  payloadSha256: string | null;

  /** The stored, encrypted rows in the version store. */
  @Column({ name: 'payload_blob', type: 'varchar', length: 64, nullable: true })
  payloadBlob: string | null;

  /** The payload's data key, wrapped by the server's backup key. */
  @Column({ name: 'wrapped_data_key', type: 'text', nullable: true, select: false })
  wrappedDataKey: string | null;

  @Column({ name: 'format_version', type: 'int', default: 1 })
  formatVersion: number;

  /** bigint: read back as a decimal string. */
  @Column({ name: 'size_bytes', type: 'bigint', default: 0 })
  sizeBytes: string;

  /** Rows per table, for the list ("312 transactions, 14 statements"). */
  @Column({ name: 'row_counts', type: 'jsonb', default: {} })
  rowCounts: Record<string, number>;

  /** Every hash in the version store this version needs: the payload and the documents. */
  @Column({ name: 'file_refs', type: 'text', array: true, default: '{}' })
  fileRefs: string[];

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
