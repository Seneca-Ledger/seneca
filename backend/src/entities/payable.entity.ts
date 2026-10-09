import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

export enum PayableStatus {
  TO_PAY = 'to_pay',
  SCHEDULED = 'scheduled',
  /** Some money has arrived, but not all of it. */
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  OVERDUE = 'overdue',
  ARCHIVED = 'archived',
}

export enum PayableSource {
  STATEMENT = 'statement',
  INVOICE = 'invoice',
  MANUAL = 'manual',
}

/** Which way the money flows: something we owe, or something owed to us. */
export enum PayableDirection {
  PAYABLE = 'payable',
  RECEIVABLE = 'receivable',
}

@Entity('payables')
@Index('IDX_payables_workspace_status', ['workspaceId', 'direction', 'status'])
@Index('IDX_payables_workspace_due_date', ['workspaceId', 'dueDate'])
export class Payable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @Column({
    type: 'enum',
    enum: PayableDirection,
    default: PayableDirection.PAYABLE,
  })
  direction: PayableDirection;

  /** Counterparty: who we owe for a payable, who owes us for a receivable. */
  @Column({ type: 'varchar', length: 255 })
  vendor: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date | null;

  @Column({
    type: 'enum',
    enum: PayableStatus,
    default: PayableStatus.TO_PAY,
  })
  status: PayableStatus;

  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'linked_transaction_id' })
  linkedTransaction: Transaction | null;

  @Column({ name: 'linked_transaction_id', type: 'uuid', nullable: true })
  linkedTransactionId: string | null;

  @Column({
    type: 'enum',
    enum: PayableSource,
    default: PayableSource.MANUAL,
  })
  source: PayableSource;

  @Column({ name: 'is_recurring', type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'statement_id', type: 'uuid', nullable: true })
  statementId: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /**
   * Sum of the payments against it, kept alongside them so a list does not
   * have to aggregate to show what is still outstanding.
   */
  @Column({ name: 'paid_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  paidAmount: number;

  @Column({ name: 'due_soon_notified_at', type: 'timestamptz', nullable: true })
  dueSoonNotifiedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
