import {
  type BaseLine,
  baseDifference,
  fromLineColumns,
  manualBaseLines,
  type ManualLeg,
  type Leg,
  openingBalanceLegs,
  reversedLines,
  revaluationLines,
  sameLines,
  skipReason,
  type TransactionFacts,
  toBaseLines,
  toLineColumns,
  transactionLegs,
} from '@/modules/ledger/ledger-posting.rules';

const ACCOUNTS = {
  cash: 'cash',
  counterpart: 'category',
  vatReceivable: 'vat-in',
  vatPayable: 'vat-out',
};

const facts = (overrides: Partial<TransactionFacts> = {}): TransactionFacts => ({
  transactionType: 'expense',
  amount: '100.00',
  debit: '100.00',
  credit: null,
  taxAmount: null,
  taxReverseCharge: false,
  taxNotionalAmount: null,
  isDuplicate: false,
  isVerified: true,
  cryptoWalletId: null,
  categoryId: 'cat-1',
  branchId: null,
  ...overrides,
});

const legsOf = (tx: TransactionFacts, accounts = ACCOUNTS): Leg[] => {
  const result = transactionLegs(tx, accounts);
  if ('skip' in result) {
    throw new Error(`unexpected skip: ${result.skip}`);
  }
  return result.legs;
};

/** Compact view: account, side, amount in minor units. */
const view = (legs: Leg[]) => legs.map(leg => [leg.accountId, leg.side, leg.amountMinor]);

const balance = (lines: Array<{ side: string; amountMinor: number }>) =>
  lines.reduce((sum, line) => sum + (line.side === 'debit' ? line.amountMinor : -line.amountMinor), 0);

const baseBalance = (lines: BaseLine[]) =>
  lines.reduce((sum, line) => sum + (line.side === 'debit' ? line.baseMinor : -line.baseMinor), 0);

describe('ledger posting rules', () => {
  describe('one case per row of the posting table', () => {
    it('expense without tax: Dr expense / Cr cash', () => {
      expect(view(legsOf(facts()))).toEqual([
        ['category', 'debit', 10000],
        ['cash', 'credit', 10000],
      ]);
    });

    it('income without tax: Dr cash / Cr income', () => {
      const legs = legsOf(facts({ transactionType: 'income', debit: null, credit: '250.40', amount: '250.40' }));
      expect(view(legs)).toEqual([
        ['cash', 'debit', 25040],
        ['category', 'credit', 25040],
      ]);
    });

    it('expense with tax: Dr expense net + Dr VAT receivable / Cr cash gross', () => {
      const legs = legsOf(facts({ amount: '121.00', taxAmount: '21.00' }));
      expect(view(legs)).toEqual([
        ['category', 'debit', 10000],
        ['vat-in', 'debit', 2100],
        ['cash', 'credit', 12100],
      ]);
      expect(balance(legs)).toBe(0);
    });

    it('income with tax: Dr cash gross / Cr income net + Cr VAT payable', () => {
      const legs = legsOf(facts({ transactionType: 'income', amount: '119.00', taxAmount: '19.00' }));
      expect(view(legs)).toEqual([
        ['cash', 'debit', 11900],
        ['category', 'credit', 10000],
        ['vat-out', 'credit', 1900],
      ]);
    });

    it('takes the stored tax as is and derives the net leg by subtraction', () => {
      const legs = legsOf(facts({ amount: '10.00', taxAmount: '1.60' }));
      expect(view(legs)).toEqual([
        ['category', 'debit', 840],
        ['vat-in', 'debit', 160],
        ['cash', 'credit', 1000],
      ]);
    });

    it('no category: the caller passes SUSPENSE as the counterpart, the rule books to it', () => {
      const legs = legsOf(facts({ categoryId: null }), { ...ACCOUNTS, counterpart: 'suspense' });
      expect(view(legs)).toEqual([
        ['suspense', 'debit', 10000],
        ['cash', 'credit', 10000],
      ]);
    });

    it('no statement or wallet: the caller passes CASH_UNALLOCATED as the cash account', () => {
      const legs = legsOf(facts(), { ...ACCOUNTS, cash: 'unallocated' });
      expect(view(legs)).toEqual([
        ['category', 'debit', 10000],
        ['unallocated', 'credit', 10000],
      ]);
    });

    it('duplicate: not booked at all', () => {
      expect(transactionLegs(facts({ isDuplicate: true }), ACCOUNTS)).toEqual({ skip: 'duplicate' });
    });

    it('unconfirmed: not booked until the user approves it in Review', () => {
      expect(transactionLegs(facts({ isVerified: false }), ACCOUNTS)).toEqual({
        skip: 'unconfirmed',
      });
    });

    it('opening balance: Dr cash / Cr opening-balance equity', () => {
      expect(view(openingBalanceLegs('1500.25', 'cash', 'opening'))).toEqual([
        ['cash', 'debit', 150025],
        ['opening', 'credit', 150025],
      ]);
    });
  });

  it('flips an overdrawn opening balance and drops a zero one', () => {
    expect(view(openingBalanceLegs('-40.00', 'cash', 'opening'))).toEqual([
      ['cash', 'credit', 4000],
      ['opening', 'debit', 4000],
    ]);
    expect(openingBalanceLegs('0.00', 'cash', 'opening')).toEqual([]);
    expect(openingBalanceLegs(null, 'cash', 'opening')).toEqual([]);
  });

  it('books a negative expense (a refund) on the opposite sides', () => {
    expect(view(legsOf(facts({ amount: '-30.00' })))).toEqual([
      ['category', 'credit', 3000],
      ['cash', 'debit', 3000],
    ]);
  });

  it('self-assesses reverse-charge VAT on a purchase without touching cash', () => {
    const legs = legsOf(
      facts({ amount: '100.00', taxAmount: '0', taxReverseCharge: true, taxNotionalAmount: '19.00' }),
    );
    expect(view(legs)).toEqual([
      ['category', 'debit', 10000],
      ['cash', 'credit', 10000],
      ['vat-in', 'debit', 1900],
      ['vat-out', 'credit', 1900],
    ]);
    expect(balance(legs)).toBe(0);
  });

  it('skips zero amounts but not crypto, and falls back to debit/credit when amount is empty', () => {
    expect(skipReason(facts({ cryptoWalletId: 'w' }))).toBeNull();
    expect(skipReason(facts({ amount: '0.00' }))).toBe('zero_amount');
    expect(view(legsOf(facts({ amount: null, debit: '12.00' })))).toEqual([
      ['category', 'debit', 1200],
      ['cash', 'credit', 1200],
    ]);
  });

  it('carries category and branch onto every line as analytics', () => {
    const legs = legsOf(facts({ taxAmount: '5.00', branchId: 'branch-1' }));
    for (const leg of legs) {
      expect(leg).toMatchObject({ categoryId: 'cat-1', branchId: 'branch-1' });
    }
  });

  describe('base currency', () => {
    it('copies amounts at rate 1 when the operation is already in base currency', () => {
      const lines = toBaseLines(legsOf(facts({ amount: '121.00', taxAmount: '21.00' })), 'EUR', 'EUR', 1.23);
      for (const line of lines) {
        expect(line.baseMinor).toBe(line.amountMinor);
        expect(line.fxRate).toBe(1);
      }
    });

    it('lets the split side absorb the rounding residue and keeps cash exact', () => {
      // 0.05 + 0.05 at 0.5 rounds each debit up to 0.03 against an exact 0.05 of cash.
      const legs: Leg[] = [
        { accountId: 'a', side: 'debit', amountMinor: 5 },
        { accountId: 'b', side: 'debit', amountMinor: 5 },
        { accountId: 'cash', side: 'credit', amountMinor: 10 },
      ];
      const lines = toBaseLines(legs, 'USD', 'EUR', 0.5);
      expect(lines.map(line => line.baseMinor)).toEqual([2, 3, 5]);
      expect(baseBalance(lines)).toBe(0);
    });

    it('keeps the cash leg at its exact conversion on a taxed income too', () => {
      const lines = toBaseLines(
        legsOf(facts({ transactionType: 'income', amount: '0.30', taxAmount: '0.05' })),
        'USD',
        'EUR',
        0.5,
      );
      // cash 0.30 -> 0.15 exactly; income 0.25 -> 0.13 and VAT 0.05 -> 0.03 overshoot by a
      // cent, which comes off the income leg rather than the cash leg.
      expect(lines.map(line => [line.accountId, line.baseMinor])).toEqual([
        ['cash', 15],
        ['category', 12],
        ['vat-out', 3],
      ]);
      expect(baseBalance(lines)).toBe(0);
    });

    it('balances a taxed foreign-currency expense to the cent', () => {
      for (const rate of [0.92137, 1.0851, 0.00193, 518.37, 36.28]) {
        const lines = toBaseLines(
          legsOf(facts({ amount: '1234.57', taxAmount: '214.26' })),
          'USD',
          'EUR',
          rate,
        );
        expect(baseBalance(lines)).toBe(0);
        expect(lines.every(line => line.fxRate === Number(rate.toFixed(8)))).toBe(true);
      }
    });

    it('refuses unbalanced legs and nonsense rates', () => {
      expect(() =>
        toBaseLines([{ accountId: 'a', side: 'debit', amountMinor: 1 }], 'EUR', 'EUR', 1),
      ).toThrow(/unbalanced/);
      const legs = legsOf(facts());
      expect(() => toBaseLines(legs, 'USD', 'EUR', 0)).toThrow(/Invalid exchange rate/);
      expect(() => toBaseLines(legs, 'USD', 'EUR', Number.NaN)).toThrow(/Invalid exchange rate/);
    });
  });

  describe('storing and comparing lines', () => {
    const lines = toBaseLines(legsOf(facts({ amount: '121.00', taxAmount: '21.00' })), 'USD', 'EUR', 0.9);

    it('round-trips through the column format exactly', () => {
      const stored = lines.map(line => toLineColumns(line));
      expect(stored[0]).toMatchObject({ debit: '100.00', credit: '0.00', baseDebit: '90.00', fxRate: '0.90000000' });
      expect(sameLines(stored.map(fromLineColumns), lines)).toBe(true);
    });

    it('treats line order as irrelevant but any amount change as a difference', () => {
      expect(sameLines([...lines].reverse(), lines)).toBe(true);
      const changed = lines.map((line, index) => (index === 0 ? { ...line, baseMinor: line.baseMinor + 1 } : line));
      expect(sameLines(changed, lines)).toBe(false);
      expect(sameLines(lines.slice(1), lines)).toBe(false);
    });

    it('reverses by swapping sides and keeping amounts', () => {
      const reversal = reversedLines(lines);
      expect(reversal.map(line => line.side)).toEqual(['credit', 'credit', 'debit']);
      expect(baseBalance([...lines, ...reversal])).toBe(0);
      expect(reversal.map(line => line.baseMinor)).toEqual(lines.map(line => line.baseMinor));
    });
  });

  describe('manual entries', () => {
    const rates: Record<string, number> = { EUR: 1, USD: 0.5 };
    const rateOf = (currency: string) => rates[currency];

    it('treats a balanced single-currency entry like a transaction: residue absorbed', () => {
      const legs: ManualLeg[] = [
        { accountId: 'a', side: 'debit', amountMinor: 5, currency: 'USD' },
        { accountId: 'b', side: 'debit', amountMinor: 5, currency: 'USD' },
        { accountId: 'cash', side: 'credit', amountMinor: 10, currency: 'USD' },
      ];
      const lines = manualBaseLines(legs, 'EUR', rateOf);
      expect(lines.map(line => line.baseMinor)).toEqual([2, 3, 5]);
      expect(baseDifference(lines)).toBe(0);
    });

    it('converts mixed currencies line by line and reports the difference instead of hiding it', () => {
      // 100 USD bought for 51 EUR at a 0.5 reference rate: 1 EUR of FX loss the user must book.
      const legs: ManualLeg[] = [
        { accountId: 'usd-cash', side: 'debit', amountMinor: 10000, currency: 'USD' },
        { accountId: 'eur-cash', side: 'credit', amountMinor: 5100, currency: 'EUR' },
      ];
      const lines = manualBaseLines(legs, 'EUR', rateOf);
      expect(lines.map(line => [line.baseMinor, line.fxRate])).toEqual([
        [5000, 0.5],
        [5100, 1],
      ]);
      expect(baseDifference(lines)).toBe(-100);

      const withLoss = manualBaseLines(
        [...legs, { accountId: 'fx-loss', side: 'debit', amountMinor: 100, currency: 'EUR' }],
        'EUR',
        rateOf,
      );
      expect(baseDifference(withLoss)).toBe(0);
    });

    it('keeps an unbalanced draft as entered', () => {
      const lines = manualBaseLines(
        [{ accountId: 'a', side: 'debit', amountMinor: 700, currency: 'EUR' }],
        'EUR',
        rateOf,
      );
      expect(lines).toHaveLength(1);
      expect(baseDifference(lines)).toBe(700);
      expect(manualBaseLines([], 'EUR', rateOf)).toEqual([]);
    });

    it('refuses a missing rate', () => {
      expect(() =>
        manualBaseLines(
          [
            { accountId: 'a', side: 'debit', amountMinor: 1, currency: 'TRY' },
            { accountId: 'b', side: 'credit', amountMinor: 1, currency: 'EUR' },
          ],
          'EUR',
          rateOf,
        ),
      ).toThrow(/Invalid exchange rate/);
    });
  });
});

describe('revaluationLines', () => {
  const FX = { fxGain: 'fx-gain', fxLoss: 'fx-loss' };
  const usd = (docMinor: number, baseMinor: number, accountId = 'usd-cash') => ({
    accountId,
    currency: 'USD',
    docMinor,
    baseMinor,
  });

  it('books a gain when a foreign asset is worth more at the new rate', () => {
    // 1,000.00 USD booked at 0.90 = 900.00 EUR, worth 950.00 at 0.95.
    const lines = revaluationLines([usd(100000, 90000)], () => 0.95, 'EUR', FX);

    expect(lines).toEqual([
      { accountId: 'usd-cash', side: 'debit', amountMinor: 0, currency: 'USD', baseMinor: 5000, fxRate: 0.95 },
      { accountId: 'fx-gain', side: 'credit', amountMinor: 5000, currency: 'EUR', baseMinor: 5000, fxRate: 1 },
    ]);
    expect(baseDifference(lines)).toBe(0);
  });

  it('books a loss when the foreign currency weakens', () => {
    const lines = revaluationLines([usd(100000, 90000)], () => 0.85, 'EUR', FX);

    expect(lines.map(line => [line.accountId, line.side, line.baseMinor])).toEqual([
      ['usd-cash', 'credit', 5000],
      ['fx-loss', 'debit', 5000],
    ]);
  });

  it('books a loss when a foreign liability grows in base terms', () => {
    // A 1,000.00 USD loan (credit balance) booked at 0.90 costs more at 0.95.
    const lines = revaluationLines([usd(-100000, -90000, 'usd-loan')], () => 0.95, 'EUR', FX);

    expect(lines.map(line => [line.accountId, line.side, line.baseMinor])).toEqual([
      ['usd-loan', 'credit', 5000],
      ['fx-loss', 'debit', 5000],
    ]);
  });

  it('skips balances already at the rate, and books gains and losses side by side', () => {
    const lines = revaluationLines(
      [usd(100000, 95000), usd(100000, 90000, 'usd-bank'), { ...usd(-50000, -45000, 'gbp-loan'), currency: 'GBP' }],
      currency => (currency === 'USD' ? 0.95 : 1),
      'EUR',
      FX,
    );

    expect(lines.map(line => [line.accountId, line.side, line.baseMinor])).toEqual([
      ['usd-bank', 'debit', 5000],
      ['gbp-loan', 'credit', 5000],
      ['fx-gain', 'credit', 5000],
      ['fx-loss', 'debit', 5000],
    ]);
    expect(baseDifference(lines)).toBe(0);
  });

  it('clears the base residue of a spent foreign balance', () => {
    const lines = revaluationLines([usd(0, 120)], () => 0.95, 'EUR', FX);

    expect(lines.map(line => [line.accountId, line.side, line.baseMinor])).toEqual([
      ['usd-cash', 'credit', 120],
      ['fx-loss', 'debit', 120],
    ]);
  });

  it('round-trips a line with no document amount through the columns, and reverses it', () => {
    const [line] = revaluationLines([usd(100000, 90000)], () => 0.95, 'EUR', FX);
    const columns = toLineColumns(line);

    expect(columns).toMatchObject({ debit: '0.00', credit: '0.00', baseDebit: '50.00', baseCredit: '0.00' });
    expect(fromLineColumns({ ...columns, categoryId: null, branchId: null })).toEqual({
      ...line,
      categoryId: null,
      branchId: null,
    });
    expect(toLineColumns(reversedLines([line])[0])).toMatchObject({ baseDebit: '0.00', baseCredit: '50.00' });
  });

  it('refuses a missing rate', () => {
    expect(() => revaluationLines([usd(100, 90)], () => Number.NaN, 'EUR', FX)).toThrow(
      /Invalid exchange rate/,
    );
  });
});
