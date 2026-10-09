import {
  canReadPrivate,
  PRIVATE_PLACEHOLDER,
  redactPrivate,
  redactPrivateRows,
} from '@/common/utils/transaction-privacy.util';
import type { Transaction } from '@/entities/transaction.entity';

const OWNER = 'member-owner';
const PARTNER = 'member-partner';

const row = (overrides: Partial<Transaction> = {}): Transaction =>
  ({
    id: 'tx-1',
    isPrivate: true,
    ownerMemberId: OWNER,
    counterpartyName: 'Jewellery shop',
    paymentPurpose: 'Anniversary gift',
    documentNumber: 'DOC-9',
    counterpartyBin: '123',
    comments: 'do not tell',
    amount: 70,
    currency: 'EUR',
    transactionDate: new Date('2026-12-14'),
    categoryId: 'cat-private',
    privateCategoryId: 'cat-gifts',
    ...overrides,
  }) as unknown as Transaction;

describe('canReadPrivate', () => {
  it('lets anyone read a row that is not private', () => {
    expect(canReadPrivate(row({ isPrivate: false }), PARTNER)).toBe(true);
  });

  it('lets the owner read their own private row', () => {
    expect(canReadPrivate(row(), OWNER)).toBe(true);
  });

  it('refuses everyone else', () => {
    expect(canReadPrivate(row(), PARTNER)).toBe(false);
    expect(canReadPrivate(row(), null)).toBe(false);
  });

  it('refuses a row that is private and belongs to nobody', () => {
    // Should not exist — the write path refuses it — but if a row ever gets
    // there, erring towards hiding is the safe direction.
    expect(canReadPrivate(row({ ownerMemberId: null }), PARTNER)).toBe(false);
  });
});

describe('redactPrivate', () => {
  it('leaves the owner’s own row untouched', () => {
    const mine = redactPrivate(row(), OWNER);
    expect(mine.counterpartyName).toBe('Jewellery shop');
    expect(mine.privateCategoryId).toBe('cat-gifts');
  });

  it('blanks what the row was, for anyone else', () => {
    const theirs = redactPrivate(row(), PARTNER);
    expect(theirs.counterpartyName).toBe(PRIVATE_PLACEHOLDER);
    expect(theirs.paymentPurpose).toBe(PRIVATE_PLACEHOLDER);
    expect(theirs.documentNumber).toBe(PRIVATE_PLACEHOLDER);
    expect(theirs.comments).toBe(PRIVATE_PLACEHOLDER);
  });

  it('keeps the money and the date, which the household’s totals are made of', () => {
    // Hiding the amount is what would make a total stop matching its rows, and
    // that difference is the hidden row.
    const theirs = redactPrivate(row(), PARTNER);
    expect(theirs.amount).toBe(70);
    expect(theirs.currency).toBe('EUR');
    expect(theirs.transactionDate).toEqual(new Date('2026-12-14'));
  });

  it('keeps the Private category it is counted under, and drops the real one', () => {
    const theirs = redactPrivate(row(), PARTNER);
    expect(theirs.categoryId).toBe('cat-private');
    expect(theirs.privateCategoryId).toBeNull();
  });

  it('leaves a row that is not private alone', () => {
    const open = redactPrivate(row({ isPrivate: false }), PARTNER);
    expect(open.counterpartyName).toBe('Jewellery shop');
  });
});

describe('redactPrivateRows', () => {
  it('redacts only the rows the viewer may not read', () => {
    const rows = [
      row({ id: 'mine' }),
      row({ id: 'theirs', ownerMemberId: PARTNER }),
      row({ id: 'open', isPrivate: false, counterpartyName: 'Bakery' }),
    ];

    const seen = redactPrivateRows(rows, PARTNER);

    expect(seen.map(item => item.counterpartyName)).toEqual([
      PRIVATE_PLACEHOLDER,
      'Jewellery shop',
      'Bakery',
    ]);
  });
});
