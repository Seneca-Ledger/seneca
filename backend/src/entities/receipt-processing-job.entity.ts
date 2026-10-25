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
import { Receipt } from './receipt.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

type ReceiptJobResult = Record<string, unknown> | null;

export enum ReceiptJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('receipt_processing_jobs')
@Index(['status'])
@Index(['lockedAt'])
export class ReceiptProcessingJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Nullable: старые записи созданы до появления скоупинга; новые всегда пишут его.
  @ManyToOne(() => Workspace, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace | null>;

  @Column({ name: 'workspace_id', type: 'uuid', nullable: true })
  @Index()
  workspaceId: string | null;

  @ManyToOne(() => Receipt, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'receipt_id' })
  receipt: Relation<Receipt | null>;

  @Column({ name: 'receipt_id', type: 'uuid', nullable: true })
  receiptId: string | null;

  @Column({
    type: 'enum',
    enum: ReceiptJobStatus,
    default: ReceiptJobStatus.PENDING,
  })
  status: ReceiptJobStatus;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ type: 'jsonb' })
  payload: {
    integrationId: string;
    messageId: string;
    historyId?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  result: ReceiptJobResult;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'locked_at', type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @Column({ type: 'varchar', name: 'locked_by', nullable: true })
  lockedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
