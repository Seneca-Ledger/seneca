import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

export enum LedgerAccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  INCOME = 'income',
  EXPENSE = 'expense',
}

export enum NormalBalance {
  DEBIT = 'debit',
  CREDIT = 'credit',
}

/** The side that increases an account of this type. Pinned by a CHECK in the database. */
export function normalBalanceFor(type: LedgerAccountType): NormalBalance {
  return type === LedgerAccountType.ASSET || type === LedgerAccountType.EXPENSE
    ? NormalBalance.DEBIT
    : NormalBalance.CREDIT;
}

/**
 * An account of the double-entry chart. Its balance is derived from journal
 * lines, never stored.
 *
 * Not the same thing as `BalanceAccount`: that tree presents the balance sheet
 * from manually entered snapshots. `balanceAccountId` lets a ledger account
 * feed a line of that tree later without the two models merging.
 *
 * Cash accounts are keyed by the statement they come from
 * (`statementAccountKey` = bank|account number|currency) because the data has
 * statements but no wallets; `walletId` is an optional refinement.
 */
@Entity('ledger_accounts')
@Index('UQ_ledger_accounts_workspace_code', ['workspaceId', 'code'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class LedgerAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(
    () => LedgerAccount,
    account => account.children,
    { nullable: true },
  )
  @JoinColumn({ name: 'parent_id' })
  parent: LedgerAccount | null;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @OneToMany(
    () => LedgerAccount,
    account => account.parent,
  )
  children: LedgerAccount[];

  @Column({ length: 40 })
  code: string;

  @Column({ length: 255 })
  name: string;

  @Column({ name: 'account_type', type: 'varchar', length: 20 })
  accountType: LedgerAccountType;

  @Column({ name: 'normal_balance', type: 'varchar', length: 6 })
  normalBalance: NormalBalance;

  /** Set on cash accounts: every line booked here must be in this currency. */
  @Column({ type: 'varchar', length: 10, nullable: true })
  currency: string | null;

  /** False for section headers, which group accounts and never carry lines. */
  @Column({ name: 'is_postable', default: true })
  isPostable: boolean;

  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ name: 'balance_account_id', type: 'uuid', nullable: true })
  balanceAccountId: string | null;

  @Column({ name: 'wallet_id', type: 'uuid', nullable: true })
  walletId: string | null;

  @Column({ name: 'crypto_wallet_id', type: 'uuid', nullable: true })
  cryptoWalletId: string | null;

  @Column({ name: 'statement_account_key', type: 'varchar', length: 255, nullable: true })
  statementAccountKey: string | null;

  @Column({ default: 0 })
  position: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
