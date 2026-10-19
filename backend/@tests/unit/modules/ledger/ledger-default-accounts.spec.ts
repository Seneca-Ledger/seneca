import { LedgerAccountType } from '@/entities/ledger-account.entity';
import {
  categoryAccountCode,
  DEFAULT_LEDGER_ACCOUNTS,
  LEDGER_ACCOUNT_CODES,
} from '@/modules/ledger/ledger-default-accounts';

describe('default ledger chart', () => {
  it('lists every parent before its children', () => {
    const seen = new Set<string>();
    for (const definition of DEFAULT_LEDGER_ACCOUNTS) {
      if (definition.parentCode) {
        expect(seen).toContain(definition.parentCode);
      }
      seen.add(definition.code);
    }
  });

  it('keeps codes unique and within the column width', () => {
    const codes = DEFAULT_LEDGER_ACCOUNTS.map(definition => definition.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code.length).toBeLessThanOrEqual(40);
    }
  });

  it('seeds every account the posting rules refer to', () => {
    const codes = new Set(DEFAULT_LEDGER_ACCOUNTS.map(definition => definition.code));
    for (const code of Object.values(LEDGER_ACCOUNT_CODES)) {
      expect(codes).toContain(code);
    }
  });

  it('gives children the type of their parent and posts only to leaves', () => {
    const byCode = new Map(DEFAULT_LEDGER_ACCOUNTS.map(definition => [definition.code, definition]));
    for (const definition of DEFAULT_LEDGER_ACCOUNTS) {
      const parent = definition.parentCode ? byCode.get(definition.parentCode) : undefined;
      if (parent) {
        expect(parent.accountType).toBe(definition.accountType);
        expect(parent.isPostable).toBe(false);
      }
    }
  });

  it('has a section header for each of the five account types', () => {
    const roots = DEFAULT_LEDGER_ACCOUNTS.filter(definition => definition.parentCode === null);
    expect(roots.map(root => root.accountType).sort()).toEqual(
      Object.values(LedgerAccountType).sort(),
    );
  });

  it('derives a stable category account code from the category id', () => {
    const id = '3f2a9c1e-0b7d-4e55-9a10-6c2d8e4f1a2b';
    expect(categoryAccountCode('expense', id)).toBe('EXPENSE_3F2A9C1E');
    expect(categoryAccountCode('income', id)).toBe('INCOME_3F2A9C1E');
    expect(categoryAccountCode('expense', id)).toBe(categoryAccountCode('expense', id));
  });
});
