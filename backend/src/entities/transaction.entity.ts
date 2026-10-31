import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { payeeKeyOf } from '../common/utils/payee-key.util';
import type { PaymentType } from '../contracts/transactions/payment-type';
import { Branch } from './branch.entity';
import { Category } from './category.entity';
import { CryptoWallet } from './crypto-wallet.entity';
import { ImportSession } from './import-session.entity';
import { Payee } from './payee.entity';
import { Statement } from './statement.entity';
import { Tag } from './tag.entity';
import { TaxRate } from './tax-rate.entity';
import { TaxRule } from './tax-rule.entity';
import { TaxSource } from './tax-source';
import { TransactionCategorySource } from './transaction-category-source';
import { Wallet } from './wallet.entity';
import { Workspace } from './workspace.entity';
import { WorkspaceMember } from './workspace-member.entity';

export { TaxSource, TransactionCategorySource };

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense',
}

/** What a pair of linked legs represents. */
/**
 * A synced row is the value that moved, the fee that moved it, or a move between
 * two places the user already owns — which changes where coins are and nothing
 * about what they cost, so it is neither income, spending, nor a lot event.
 */
export type CryptoLeg = 'value' | 'fee' | 'move';

export enum TransferPairKind {
  /** Money moved between the user's own accounts. */
  TRANSFER = 'transfer',
  /** Money paid out and paid back in full (a work expense, a split bill). */
  REIMBURSEMENT = 'reimbursement',
  /** Money moved into an investment or retirement account: a one-leg transfer. */
  INVESTMENT = 'investment',
}

/** How the two legs of a transfer came to be linked. */
export enum TransferPairSource {
  AUTO = 'auto',
  MANUAL = 'manual',
  /** The user unlinked the row; auto-pairing leaves it alone from then on. */
  REJECTED = 'rejected',
}

@Entity('transactions')
@Index('IDX_transactions_workspace_date_amount', ['workspaceId', 'transactionDate', 'amount'])
// Partial, matching the migration: only split rows are ever looked up by group.
@Index('IDX_transactions_workspace_split_group', ['workspaceId', 'splitGroupId'], {
  where: '"split_group_id" IS NOT NULL',
})
@Index('IDX_transactions_workspace_transfer_pair', ['workspaceId', 'transferPairId'], {
  where: '"transfer_pair_id" IS NOT NULL',
})
// Makes a crypto sync idempotent: re-reading the chain re-offers rows we already
// have, and the insert simply loses the race with itself. One on-chain transaction
// can legitimately produce several rows (a native transfer plus a token transfer,
// or an in and an out leg), which is why asset, direction and leg are part of the
// key. `crypto_leg` is never null on a synced row, so the index cannot be defeated
// by Postgres treating NULLs as distinct.
@Index(
  'IDX_transactions_crypto_tx',
  ['workspaceId', 'cryptoWalletId', 'cryptoTxHash', 'cryptoAsset', 'transactionType', 'cryptoLeg'],
  { unique: true, where: '"crypto_tx_hash" IS NOT NULL' },
)
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Relation<Workspace>;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  @ManyToOne(
    () => Statement,
    statement => statement.transactions,
    { nullable: true },
  )
  @JoinColumn({ name: 'statement_id' })
  statement: Relation<Statement | null>;

  @Column({ name: 'statement_id', type: 'uuid', nullable: true })
  statementId: string | null;

  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate: Date;

  @Column({ type: 'varchar', name: 'document_number', nullable: true })
  documentNumber: string | null;

  @Column({ name: 'counterparty_name' })
  counterpartyName: string;

  @Column({ type: 'varchar', name: 'counterparty_bin', nullable: true })
  counterpartyBin: string | null;

  @Column({ type: 'varchar', name: 'counterparty_account', nullable: true })
  counterpartyAccount: string | null;

  @Column({ type: 'varchar', name: 'counterparty_bank', nullable: true })
  counterpartyBank: string | null;

  /**
   * ISO-3166-1 alpha-2. Together with the VAT id below, this is what decides
   * whether a cross-border supply is reverse-charged.
   */
  @Column({ name: 'counterparty_country', type: 'varchar', length: 2, nullable: true })
  counterpartyCountry: string | null;

  /** Its presence is what makes the other party a business rather than a consumer. */
  @Column({ name: 'counterparty_vat_id', type: 'varchar', length: 32, nullable: true })
  counterpartyVatId: string | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  debit: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  credit: number | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  amount: number | null;

  @Column()
  currency: string;

  @Column({ name: 'exchange_rate', type: 'decimal', precision: 10, scale: 4, nullable: true })
  exchangeRate: number | null;

  @Column({ name: 'amount_foreign', type: 'decimal', precision: 15, scale: 2, nullable: true })
  amountForeign: number | null;

  @Column({ name: 'payment_purpose', type: 'text' })
  paymentPurpose: string;

  /** How the bank's statement says the money moved; null unless its parser sets it. */
  @Column({ name: 'payment_type', type: 'text', nullable: true })
  paymentType: PaymentType | null;

  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'category_id' })
  category: Relation<Category | null>;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @ManyToOne(() => TaxRate, { nullable: true })
  @JoinColumn({ name: 'tax_rate_id' })
  taxRate: Relation<TaxRate | null>;

  @Column({ name: 'tax_rate_id', type: 'uuid', nullable: true })
  taxRateId: string | null;

  @ManyToOne(() => Branch, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_id' })
  branch: Relation<Branch | null>;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @ManyToOne(() => Wallet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'wallet_id' })
  wallet: Relation<Wallet | null>;

  @Column({ name: 'wallet_id', type: 'uuid', nullable: true })
  walletId: string | null;

  /**
   * Which member of the household this row belongs to; NULL means it is shared.
   *
   * It points at the membership, not the user, so ownership is scoped to this
   * workspace, and SET NULL means a member leaving turns their rows into shared
   * ones instead of deleting them. A new row inherits it from its wallet.
   */
  @ManyToOne(() => WorkspaceMember, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'owner_member_id' })
  ownerMember: Relation<WorkspaceMember | null>;

  @Column({ name: 'owner_member_id', type: 'uuid', nullable: true })
  ownerMemberId: string | null;

  /**
   * Hides what the row was, never that it happened: the date and the amount
   * stay visible to the whole household, the merchant and the purpose do not.
   *
   * Only the row's owner can set it, and only on a row that is theirs — a row
   * the household shares has nobody to keep a secret from.
   */
  @Column({ name: 'is_private', type: 'boolean', default: false })
  isPrivate: boolean;

  /**
   * The category the row had before it went private; `categoryId` is the
   * workspace's `Private` category while it is. Restored when privacy is
   * turned off.
   */
  @ManyToOne(() => Category, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'private_category_id' })
  privateCategory: Relation<Category | null>;

  @Column({ name: 'private_category_id', type: 'uuid', nullable: true })
  privateCategoryId: string | null;

  @ManyToOne(() => CryptoWallet, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'crypto_wallet_id' })
  cryptoWallet: Relation<CryptoWallet | null>;

  @Column({ name: 'crypto_wallet_id', type: 'uuid', nullable: true })
  cryptoWalletId: string | null;

  /**
   * Ticker of the asset that actually moved, e.g. `ETH` or `USDC`. `amount` and
   * `currency` stay fiat — the value of this transfer on its own date — so every
   * existing aggregate (dashboard, budgets, reports, net worth) keeps working
   * without knowing crypto exists.
   */
  @Column({ name: 'crypto_asset', type: 'varchar', length: 20, nullable: true })
  cryptoAsset: string | null;

  /** Native amount. Fiat's two decimals cannot hold 18-decimal token amounts. */
  @Column({ name: 'crypto_amount', type: 'decimal', precision: 38, scale: 18, nullable: true })
  cryptoAmount: string | null;

  @Column({ name: 'crypto_tx_hash', type: 'varchar', length: 66, nullable: true })
  cryptoTxHash: string | null;

  /**
   * Which part of an on-chain transaction this row is: the value that moved, or
   * the fee the chain charged when it could not be folded onto a transfer (a
   * failed call, or a swap, whose two legs cancel out while its fee does not).
   */
  @Column({ name: 'crypto_leg', type: 'varchar', length: 8, nullable: true })
  cryptoLeg: CryptoLeg | null;

  /** Fee folded onto this transfer, in `cryptoFeeAsset`; included in `amount`. */
  @Column({ name: 'crypto_fee_amount', type: 'decimal', precision: 38, scale: 18, nullable: true })
  cryptoFeeAmount: string | null;

  @Column({ name: 'crypto_fee_asset', type: 'varchar', length: 20, nullable: true })
  cryptoFeeAsset: string | null;

  /** The folded fee's value in `currency`; the rest of `amount` is the transfer itself. */
  @Column({ name: 'crypto_fee_fiat', type: 'decimal', precision: 15, scale: 2, nullable: true })
  cryptoFeeFiat: number | null;

  @Column({ type: 'varchar', nullable: true })
  article: string | null;

  @Column({ type: 'varchar', name: 'activity_type', nullable: true })
  activityType: string | null;

  @Column({ type: 'varchar', name: 'vendor_normalized', nullable: true })
  vendorNormalized: string | null;

  /**
   * The payee this row belongs to, normalised so the same shop keys the same
   * every time (`descriptor-normalizer.ts`). Internal: the raw descriptor is
   * what the user sees and what their rules match. Null when the descriptor
   * held no name to key on.
   */
  @Index()
  @Column({ name: 'payee_key', type: 'text', nullable: true })
  payeeKey: string | null;

  /**
   * Who this row was paid to or received from. Set on insert from the payee
   * key's alias (`TransactionPayeeSubscriber`), or by the user picking another
   * payee; NULL when the descriptor names nobody.
   */
  @ManyToOne(() => Payee, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payee_id' })
  payee: Relation<Payee | null>;

  @Column({ name: 'payee_id', type: 'uuid', nullable: true })
  payeeId: string | null;

  /**
   * Derived on write so that every path that books a transaction — import,
   * scan, receipt, payable, manual entry, custom table, Telegram — keys the
   * payee the same way without having to remember to.
   */
  @BeforeInsert()
  @BeforeUpdate()
  derivePayeeKey(): void {
    this.payeeKey = payeeKeyOf(this);
  }

  @Column({ type: 'varchar', name: 'category_hint', nullable: true })
  categoryHint: string | null;

  /** See `TransactionCategorySource`. Null on rows classified before it was recorded. */
  @Column({ name: 'category_source', type: 'varchar', length: 16, nullable: true })
  categorySource: TransactionCategorySource | null;

  /** The "why" shown next to the category: a rule name, a learned payee, a matched keyword. */
  @Column({ name: 'category_reason', type: 'varchar', length: 255, nullable: true })
  categoryReason: string | null;

  @Column({ type: 'varchar', name: 'transaction_nature', nullable: true })
  transactionNature: string | null;

  @Column({ name: 'tax_detected', default: false })
  taxDetected: boolean;

  /**
   * Tax assessed on this transaction, stored rather than derived.
   *
   * Deriving it on read would mean a filed return changes whenever a rate is
   * corrected. `taxRateId` above pins the exact rate version these figures
   * came from.
   */
  @Column({ name: 'tax_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  taxAmount: number | null;

  @Column({ name: 'tax_net_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  taxNetAmount: number | null;

  /** How the rate was chosen, kept so an unexpected figure can be traced back. */
  @Column({ name: 'tax_source', type: 'varchar', length: 20, nullable: true })
  taxSource: TaxSource | null;

  @Column({ name: 'tax_reverse_charge', default: false })
  taxReverseCharge: boolean;

  /**
   * The tax that would have been charged. Equal to `taxAmount` in the ordinary
   * case; under reverse charge `taxAmount` is zero and this carries the figure
   * the return reports on both sides so the entries cancel.
   */
  @Column({ name: 'tax_notional_amount', type: 'decimal', precision: 15, scale: 2, nullable: true })
  taxNotionalAmount: number | null;

  /** Which rule produced these figures, when one did. */
  @ManyToOne(() => TaxRule, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tax_rule_id' })
  taxRule: Relation<TaxRule | null>;

  @Column({ name: 'tax_rule_id', type: 'uuid', nullable: true })
  taxRuleId: string | null;

  /**
   * Overrides the category's tax-relevant mark for this one row: a doctor's
   * bill in "Health" that is deductible when the gym membership is not.
   * NULL follows the category.
   */
  @Column({ name: 'tax_relevant', type: 'boolean', nullable: true })
  taxRelevant: boolean | null;

  /** Set once this row has been included in a filed return. */
  @Column({ name: 'tax_locked', default: false })
  taxLocked: boolean;

  /**
   * Ledger sync state. Set by database triggers whenever a fact the ledger
   * entry depends on changes, cleared only by the posting worker in the
   * transaction that books the row. Never written by the application:
   * a stale value saved back from a loaded entity would lose a change.
   */
  @Column({ name: 'ledger_dirty', select: false, insert: false, update: false, default: true })
  ledgerDirty: boolean;

  @Column({
    name: 'ledger_posted_at',
    type: 'timestamptz',
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  ledgerPostedAt: Date | null;

  /** Why the last posting attempt failed; the row is retried after a pause. */
  @Column({
    name: 'ledger_error',
    type: 'text',
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  ledgerError: string | null;

  @Column({
    name: 'ledger_attempted_at',
    type: 'timestamptz',
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  ledgerAttemptedAt: Date | null;

  @Column({
    name: 'enrichment_confidence',
    type: 'decimal',
    precision: 3,
    scale: 2,
    nullable: true,
  })
  enrichmentConfidence: number | null;

  @Column({
    name: 'transaction_type',
    type: 'enum',
    enum: TransactionType,
  })
  transactionType: TransactionType;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'is_duplicate', default: false })
  isDuplicate: boolean;

  @ManyToOne(() => Transaction, { nullable: true })
  @JoinColumn({ name: 'duplicate_of_id' })
  duplicateOf: Relation<Transaction | null>;

  @Column({ name: 'duplicate_of_id', type: 'uuid', nullable: true })
  duplicateOfId: string | null;

  @Column({ name: 'duplicate_confidence', type: 'decimal', precision: 3, scale: 2, nullable: true })
  duplicateConfidence: number | null;

  @Column({ type: 'varchar', name: 'duplicate_match_type', length: 50, nullable: true })
  duplicateMatchType: string | null;

  /**
   * Groups the parts of a split transaction. All parts of one split share this id.
   * There is no parent row — the parts ARE the transaction, and their amounts sum
   * to the original amount, so all existing aggregates stay correct.
   */
  @Column({ name: 'split_group_id', type: 'uuid', nullable: true })
  splitGroupId: string | null;

  /** Position within the split group. Index 0 is the original row. */
  @Column({ name: 'split_index', type: 'smallint', nullable: true })
  splitIndex: number | null;

  /**
   * Links the two legs of a transfer between the user's own accounts; both rows
   * share this id. The legs keep their income/expense direction (account
   * balances still need it) but every spend and income aggregate leaves them
   * out, the same way it leaves out duplicates.
   */
  @Column({ name: 'transfer_pair_id', type: 'uuid', nullable: true })
  transferPairId: string | null;

  /** Set together with `transferPairId`; `rejected` survives an unlink on its own. */
  @Column({ name: 'transfer_pair_source', type: 'varchar', length: 10, nullable: true })
  transferPairSource: TransferPairSource | null;

  /** Null means `transfer`; set on both legs. */
  @Column({ name: 'transfer_pair_kind', type: 'varchar', length: 16, nullable: true })
  transferPairKind: TransferPairKind | null;

  /**
   * On an incoming row: the expense it pays back. A full repayment also
   * becomes a `reimbursement` pair so both rows leave the aggregates; a
   * partial one only records the link and still counts gross.
   */
  @ManyToOne(() => Transaction, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reimbursement_of_id' })
  reimbursementOf: Relation<Transaction | null>;

  @Column({ name: 'reimbursement_of_id', type: 'uuid', nullable: true })
  reimbursementOfId: string | null;

  /**
   * The investment account this expense bought into. Set together with a
   * self-referencing `transferPairId` of kind `investment`, so the row leaves
   * every spending aggregate the way a transfer does; the money shows up again
   * as the account's holdings.
   */
  @Column({ name: 'investment_account_id', type: 'uuid', nullable: true })
  investmentAccountId: string | null;

  @Column({ type: 'varchar', name: 'fingerprint', length: 64, nullable: true })
  fingerprint: string | null;

  @ManyToOne(() => ImportSession, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'import_session_id' })
  importSession: Relation<ImportSession | null>;

  @Column({ name: 'import_session_id', type: 'uuid', nullable: true })
  importSessionId: string | null;

  /**
   * Second axis of classification alongside the single hierarchical category:
   * shares the workspace's tag vocabulary with statements and files.
   */
  @ManyToMany(
    () => Tag,
    tag => tag.transactions,
  )
  @JoinTable({
    name: 'transaction_tags',
    joinColumn: { name: 'transaction_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Relation<Tag[]>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
