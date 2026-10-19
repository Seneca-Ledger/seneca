import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { JournalEntry } from './journal-entry.entity';
import { LedgerAccount } from './ledger-account.entity';

/**
 * One leg of a journal entry. Exactly one of `debit`/`credit` is non-zero.
 *
 * Amounts are kept twice: in the currency of the operation and in the entry's
 * base currency at `fxRate`. The balance invariant is checked on the base
 * amounts only. Decimal columns come back from the driver as strings; do the
 * arithmetic in minor units (`common/utils/money.util.ts`), never on floats.
 */
@Entity('journal_lines')
export class JournalLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(
    () => JournalEntry,
    entry => entry.lines,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'entry_id' })
  entry: JournalEntry;

  @Column({ name: 'entry_id', type: 'uuid' })
  entryId: string;

  @Column({ name: 'line_no', type: 'smallint' })
  lineNo: number;

  @ManyToOne(() => LedgerAccount)
  @JoinColumn({ name: 'account_id' })
  account: LedgerAccount;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  debit: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  credit: string;

  @Column({ type: 'varchar', length: 10 })
  currency: string;

  @Column({ name: 'base_debit', type: 'decimal', precision: 15, scale: 2, default: 0 })
  baseDebit: string;

  @Column({ name: 'base_credit', type: 'decimal', precision: 15, scale: 2, default: 0 })
  baseCredit: string;

  @Column({ name: 'fx_rate', type: 'decimal', precision: 18, scale: 8, default: 1 })
  fxRate: string;

  /** Analytics only; the account decides where the money is booked. */
  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string | null;

  @Column({ name: 'branch_id', type: 'uuid', nullable: true })
  branchId: string | null;

  @Column({ type: 'text', nullable: true })
  memo: string | null;
}
