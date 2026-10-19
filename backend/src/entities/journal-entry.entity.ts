import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JournalLine } from './journal-line.entity';
import { Workspace } from './workspace.entity';

export enum JournalEntryStatus {
  DRAFT = 'draft',
  POSTED = 'posted',
  REVERSED = 'reversed',
}

export enum JournalEntrySource {
  TRANSACTION = 'transaction',
  MANUAL = 'manual',
  OPENING_BALANCE = 'opening_balance',
  FX_REVALUATION = 'fx_revaluation',
  INVOICE = 'invoice',
  CREDIT_NOTE = 'credit_note',
}

/**
 * One journal entry: a dated set of lines whose base-currency debits equal
 * their credits.
 *
 * The database enforces the rules, not only this code: at COMMIT a booked
 * entry (posted or reversed) must balance and have at least two lines, and
 * once booked neither the entry nor its lines can be rewritten — the only
 * move left is posted -> reversed, paired with a reversal entry. A booked
 * entry is therefore created as a draft, filled, and promoted in one
 * transaction. `entryNo` is taken at posting, so drafts leave no gaps.
 */
@Entity('journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ name: 'workspace_id', type: 'uuid' })
  workspaceId: string;

  /** bigint comes back from the driver as a string. Null while a draft. */
  @Column({ name: 'entry_no', type: 'bigint', nullable: true })
  entryNo: string | null;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: string;

  /** Fixed at posting; every line's base amounts are in this currency. */
  @Column({ name: 'base_currency', type: 'varchar', length: 10 })
  baseCurrency: string;

  @Column({ type: 'text', nullable: true })
  memo: string | null;

  @Column({ type: 'varchar', length: 12, default: JournalEntryStatus.DRAFT })
  status: JournalEntryStatus;

  @Column({ type: 'varchar', length: 24 })
  source: JournalEntrySource;

  /** Nulled when the transaction is deleted; the entry itself is reversed, not removed. */
  @Column({ name: 'source_transaction_id', type: 'uuid', nullable: true })
  sourceTransactionId: string | null;

  @Column({ name: 'reversal_of_id', type: 'uuid', nullable: true })
  reversalOfId: string | null;

  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt: Date | null;

  @Column({ name: 'posted_by', type: 'uuid', nullable: true })
  postedBy: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @OneToMany(
    () => JournalLine,
    line => line.entry,
  )
  lines: JournalLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
