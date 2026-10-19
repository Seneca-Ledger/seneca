import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Budget } from './budget.entity';
import { Goal } from './goal.entity';
import { Invoice } from './invoice.entity';
import { Receipt } from './receipt.entity';
import { Statement } from './statement.entity';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/**
 * Объекты, к которым можно оставить заметку.
 *
 * Деньги обсуждают там, где на них смотрят: у Monarch комментарий живёт на
 * транзакции, и это их участники называют тем, ради чего приложение открывают
 * вдвоём. Выписка и чек были первыми, остальное — там же, где спорят.
 */
export enum NoteEntityType {
  STATEMENT = 'statement',
  RECEIPT = 'receipt',
  TRANSACTION = 'transaction',
  BUDGET = 'budget',
  GOAL = 'goal',
  INVOICE = 'invoice',
}

/**
 * Заметка команды к выписке или чеку.
 *
 * Цель хранится не полиморфной парой (type, id), а отдельной колонкой на каждый
 * тип: так работают настоящие внешние ключи, и удаление выписки или чека уносит
 * обсуждение каскадом, без ручной уборки. CHECK гарантирует ровно одну цель.
 */
@Entity('notes')
@Check(
  'CHK_notes_single_target',
  `(("statement_id" IS NOT NULL)::int + ("receipt_id" IS NOT NULL)::int
    + ("transaction_id" IS NOT NULL)::int + ("budget_id" IS NOT NULL)::int
    + ("goal_id" IS NOT NULL)::int + ("invoice_id" IS NOT NULL)::int) = 1`,
)
@Index('IDX_notes_statement', ['workspaceId', 'statementId'])
@Index('IDX_notes_receipt', ['workspaceId', 'receiptId'])
@Index('IDX_notes_transaction', ['workspaceId', 'transactionId'])
@Index('IDX_notes_budget', ['workspaceId', 'budgetId'])
@Index('IDX_notes_goal', ['workspaceId', 'goalId'])
@Index('IDX_notes_invoice', ['workspaceId', 'invoiceId'])
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(() => Statement, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'statement_id' })
  statement: Statement | null;

  @Column({ name: 'statement_id', type: 'uuid', nullable: true })
  statementId: string | null;

  @ManyToOne(() => Receipt, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'receipt_id' })
  receipt: Receipt | null;

  @Column({ name: 'receipt_id', type: 'uuid', nullable: true })
  receiptId: string | null;

  @ManyToOne(() => Transaction, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction | null;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @ManyToOne(() => Budget, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'budget_id' })
  budget: Budget | null;

  @Column({ name: 'budget_id', type: 'uuid', nullable: true })
  budgetId: string | null;

  @ManyToOne(() => Goal, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'goal_id' })
  goal: Goal | null;

  @Column({ name: 'goal_id', type: 'uuid', nullable: true })
  goalId: string | null;

  @ManyToOne(() => Invoice, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice | null;

  @Column({ name: 'invoice_id', type: 'uuid', nullable: true })
  invoiceId: string | null;

  /** Автор может быть удалён — заметка при этом остаётся. */
  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'body', type: 'text' })
  body: string;

  /**
   * Кого упомянули в теле заметки. Хранится отдельно от текста, чтобы
   * подсветка в UI не зависела от разбора имён с пробелами.
   */
  @Column({ name: 'mentioned_user_ids', type: 'jsonb', default: () => "'[]'::jsonb" })
  mentionedUserIds: string[];

  /** Проставляется при отметке «решено»; null — обсуждение открыто. */
  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
