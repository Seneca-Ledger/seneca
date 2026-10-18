import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

/** The outbound events; the contract's `WebhookEventName` lists the same, a test keeps them equal. */
export enum WebhookEvent {
  TRANSACTION_CREATED = 'transaction.created',
  TRANSACTIONS_IMPORTED = 'transactions.imported',
  STATEMENT_UPLOADED = 'statement.uploaded',
  STATEMENT_PROCESSED = 'statement.processed',
  STATEMENT_FAILED = 'statement.failed',
  TRANSACTIONS_UNCATEGORIZED = 'transactions.uncategorized',
  RECEIPT_APPROVED = 'receipt.approved',
  RECEIPT_NEEDS_REVIEW = 'receipt.needs_review',
  INVOICE_PAID = 'invoice.paid',
  INVOICE_OVERDUE = 'invoice.overdue',
  BILL_PAID = 'bill.paid',
  BILL_OVERDUE = 'bill.overdue',
  BUDGET_EXCEEDED = 'budget.exceeded',
  TAX_DEADLINE_UPCOMING = 'tax.deadline.upcoming',
  TAX_THRESHOLD_REACHED = 'tax.threshold.reached',
}

@Entity('webhook_subscriptions')
@Index('IDX_webhook_subscriptions_workspace', ['workspaceId'])
export class WebhookSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 2048 })
  url: string;

  @Column({ type: 'varchar', length: 255 })
  secret: string;

  @Column({ type: 'text', array: true, default: '{}' })
  events: WebhookEvent[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
