import { JournalEntrySource, JournalEntryStatus } from '@/entities/journal-entry.entity';
import {
  LedgerAccountType,
  NormalBalance,
  normalBalanceFor,
} from '@/entities/ledger-account.entity';

// These strings are pinned by CHECK constraints in the CreateLedger migration;
// renaming one here without a migration makes every insert fail.
describe('ledger enums', () => {
  it('matches the account type CHECK', () => {
    expect(Object.values(LedgerAccountType)).toEqual([
      'asset',
      'liability',
      'equity',
      'income',
      'expense',
    ]);
  });

  it('matches the entry status and source CHECKs', () => {
    expect(Object.values(JournalEntryStatus)).toEqual(['draft', 'posted', 'reversed']);
    expect(Object.values(JournalEntrySource)).toEqual([
      'transaction',
      'manual',
      'opening_balance',
      'fx_revaluation',
      'invoice',
      'credit_note',
    ]);
  });

  it.each([
    [LedgerAccountType.ASSET, NormalBalance.DEBIT],
    [LedgerAccountType.EXPENSE, NormalBalance.DEBIT],
    [LedgerAccountType.LIABILITY, NormalBalance.CREDIT],
    [LedgerAccountType.EQUITY, NormalBalance.CREDIT],
    [LedgerAccountType.INCOME, NormalBalance.CREDIT],
  ])('gives %s a %s normal balance', (type, side) => {
    expect(normalBalanceFor(type)).toBe(side);
  });
});
