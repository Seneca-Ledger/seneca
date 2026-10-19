import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Payable } from './payable.entity';
import { Transaction } from './transaction.entity';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';

/**
 * Money received against one bill or invoice.
 *
 * A bill used to be paid or not paid, settled by exactly one transaction of
 * exactly the right amount — which is not how money arrives. Clients underpay,
 * pay in instalments, send one wire covering four invoices, and processors keep
 * a fee on the way. Each of those is a row here, and the bill's status is
 * derived from their sum rather than being a flag someone flips.
 */
@Entity('payable_payments')
@Index('IDX_payable_payments_payable', ['payableId', 'paidOn'])
@Index('IDX_payable_payments_transaction', ['transactionId'])
export class PayablePayment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Payable, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payable_id' })
  payable: Payable;

  @Column({ name: 'payable_id', type: 'uuid' })
  payableId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /** How much of the bill this settles, in the bill's currency. */
  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  /**
   * What the processor kept. The bank transaction is `amount - fee`, while the
   * client still owes nothing: without this the books are short by the fee and
   * the invoice never closes.
   */
  @Column({ name: 'fee_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  feeAmount: number;

  @Column({ name: 'paid_on', type: 'date' })
  paidOn: string;

  /** The bank row this came from; NULL for a payment recorded by hand. */
  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'transaction_id' })
  transaction: Transaction | null;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId: string | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
