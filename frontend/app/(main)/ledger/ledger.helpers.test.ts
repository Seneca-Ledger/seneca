import { describe, expect, it } from 'vitest';
import {
  accountDisplayName,
  amountToMinor,
  buildAccountTree,
  canPostEntry,
  canWriteLedger,
  defaultPeriod,
  draftBalance,
  formatMinor,
  isDateOnly,
  isDraftSavable,
  normaliseAmount,
  parseTab,
  withDepth,
} from './ledger.helpers';
import type { DraftLine, TrialBalanceRow } from './ledger.types';

const line = (overrides: Partial<DraftLine>): DraftLine => ({
  key: 'k',
  accountId: 'acc',
  side: 'debit',
  amount: '0',
  currency: 'EUR',
  ...overrides,
});

describe('ledger helpers', () => {
  it('falls back to the journal for an unknown tab', () => {
    expect(parseTab('trial-balance')).toBe('trial-balance');
    expect(parseTab('nope')).toBe('journal');
    expect(parseTab(null)).toBe('journal');
  });

  it('validates dates and defaults the period to the current year', () => {
    expect(isDateOnly('2026-02-28')).toBe(true);
    expect(isDateOnly('2026-13-01')).toBe(false);
    expect(isDateOnly(null)).toBe(false);
    expect(defaultPeriod(new Date('2026-09-24T10:00:00Z'))).toEqual({
      dateFrom: '2026-01-01',
      dateTo: '2026-09-24',
    });
  });

  it('nests accounts under their headers, keeping the API order', () => {
    const tree = buildAccountTree([
      { id: 'assets', parentId: null },
      { id: 'cash', parentId: 'assets' },
      { id: 'bank', parentId: 'cash' },
      { id: 'income', parentId: null },
      { id: 'vat', parentId: 'assets' },
      { id: 'lost', parentId: 'missing' },
    ]);
    expect(tree.map(row => [row.id, row.depth])).toEqual([
      ['assets', 0],
      ['cash', 1],
      ['bank', 2],
      ['vat', 1],
      ['income', 0],
      ['lost', 0],
    ]);
  });

  it('indents trial balance rows by their parent', () => {
    const row = (accountId: string, parentId: string | null) => ({ accountId, parentId }) as TrialBalanceRow;
    expect(withDepth([row('a', null), row('b', 'a'), row('c', 'b'), row('d', null)]).map(r => r.depth)).toEqual([
      0, 1, 2, 0,
    ]);
  });

  it('reads amounts exactly, in minor units, and refuses anything else', () => {
    expect(amountToMinor('12.5')).toBe(1250);
    expect(amountToMinor('12,05')).toBe(1205);
    expect(amountToMinor(' 1000 ')).toBe(100000);
    expect(amountToMinor('0.1')).toBe(10);
    // 0.1 + 0.2 must not become 0.30000000000000004 on the way.
    expect(amountToMinor('0.29')).toBe(29);
    for (const bad of ['', '0', '0.00', '-5', '1.005', 'abc', '1e3']) {
      expect(amountToMinor(bad)).toBeNull();
    }
    expect(normaliseAmount('7,5')).toBe('7.50');
    expect(formatMinor(-1205)).toBe('-12.05');
    expect(formatMinor(5)).toBe('0.05');
  });

  it('keeps a running difference over base-currency lines and flags foreign ones', () => {
    const balance = draftBalance(
      [
        line({ side: 'debit', amount: '100.10' }),
        line({ side: 'credit', amount: '60' }),
        line({ side: 'credit', amount: '40.1' }),
        line({ side: 'credit', amount: '', accountId: 'acc' }),
        line({ side: 'credit', amount: '5', accountId: '' }),
      ],
      'EUR',
    );
    expect(balance).toEqual({ debitMinor: 10010, creditMinor: 10010, differenceMinor: 0, validLines: 3, exact: true });

    const foreign = draftBalance(
      [line({ side: 'debit', amount: '100', currency: 'USD' }), line({ side: 'credit', amount: '91' })],
      'EUR',
    );
    expect(foreign).toMatchObject({ differenceMinor: -9100, exact: false, validLines: 2 });
  });

  it('offers posting only for a saved, balanced draft of at least two lines', () => {
    expect(canPostEntry({ savedDifference: '0.00', savedLines: 2, dirty: false })).toBe(true);
    expect(canPostEntry({ savedDifference: '0.00', savedLines: 2, dirty: true })).toBe(false);
    expect(canPostEntry({ savedDifference: '0.01', savedLines: 2, dirty: false })).toBe(false);
    expect(canPostEntry({ savedDifference: '0.00', savedLines: 1, dirty: false })).toBe(false);
    expect(canPostEntry({ savedDifference: null, savedLines: 0, dirty: false })).toBe(false);
  });

  it('names system accounts in the UI language and custom ones as typed', () => {
    const names = { ASSETS: 'Активы' };
    expect(accountDisplayName({ code: 'ASSETS', name: 'Assets', isSystem: true }, names)).toBe('Активы');
    expect(accountDisplayName({ code: 'ASSETS', name: 'Mine', isSystem: false }, names)).toBe('Mine');
    expect(accountDisplayName({ code: 'VAT', name: 'VAT', isSystem: true }, names)).toBe('VAT');
  });

  it('lets workspace owners and admins write, like the server guard does', () => {
    expect(canWriteLedger(false, 'owner')).toBe(true);
    expect(canWriteLedger(false, 'admin')).toBe(true);
    expect(canWriteLedger(false, 'member')).toBe(false);
    expect(canWriteLedger(false, 'viewer')).toBe(false);
    expect(canWriteLedger(false, undefined)).toBe(false);
    expect(canWriteLedger(true, 'viewer')).toBe(true);
  });

  it('saves a draft only with a date and complete lines', () => {
    expect(isDraftSavable('2026-09-01', [line({ amount: '5' })])).toBe(true);
    expect(isDraftSavable('2026-09-01', [])).toBe(true);
    expect(isDraftSavable('bad', [line({ amount: '5' })])).toBe(false);
    expect(isDraftSavable('2026-09-01', [line({ amount: '5' }), line({ accountId: '', amount: '5' })])).toBe(false);
    expect(isDraftSavable('2026-09-01', [line({ amount: 'x' })])).toBe(false);
  });
});
