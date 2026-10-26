import { fromMinor, roundHalfAwayFromZero, toMinor } from '../../common/utils/money.util';

/**
 * Posting rules as pure functions: what a transaction or an opening balance
 * books, in minor units, with no database in sight. The service resolves the
 * accounts and the rate; these functions decide the lines.
 */

export type Side = 'debit' | 'credit';

/** One leg in the currency of the operation. `amountMinor` is always positive. */
export interface Leg {
  accountId: string;
  side: Side;
  amountMinor: number;
  categoryId?: string | null;
  branchId?: string | null;
}

/** A leg with its base-currency amount, ready to become a `journal_lines` row. */
export interface BaseLine extends Leg {
  currency: string;
  baseMinor: number;
  /** The rate actually applied, rounded to the column's 8 places. */
  fxRate: number;
}

export type SkipReason = 'duplicate' | 'unconfirmed' | 'zero_amount';

export interface TransactionFacts {
  transactionType: 'income' | 'expense';
  amount: number | string | null;
  debit: number | string | null;
  credit: number | string | null;
  taxAmount: number | string | null;
  taxReverseCharge: boolean;
  taxNotionalAmount: number | string | null;
  isDuplicate: boolean;
  /** Confirmed by the user in Review; nothing unconfirmed is booked. */
  isVerified: boolean;
  cryptoWalletId: string | null;
  categoryId: string | null;
  branchId: string | null;
}

export interface TransactionAccounts {
  /** Where the money sits: the statement's cash account, a wallet's, or CASH_UNALLOCATED. */
  cash: string;
  /** The category's income/expense account, or SUSPENSE when there is none. */
  counterpart: string;
  vatReceivable: string;
  vatPayable: string;
}

export type LegsOrSkip = { legs: Leg[] } | { skip: SkipReason };

const minorOrZero = (value: number | string | null | undefined): number =>
  value === null || value === undefined || value === '' ? 0 : toMinor(value);

/**
 * A negative amount books on the other side; a zero one is dropped. The
 * data holds no negative amounts today, but a refund entered as a negative
 * expense must still produce a valid entry rather than a CHECK violation.
 */
function normalise(legs: Leg[]): Leg[] {
  return legs
    .filter(leg => leg.amountMinor !== 0)
    .map(leg =>
      leg.amountMinor > 0
        ? leg
        : {
            ...leg,
            side: leg.side === 'debit' ? ('credit' as const) : ('debit' as const),
            amountMinor: -leg.amountMinor,
          },
    );
}

const grossMinor = (tx: TransactionFacts): number =>
  minorOrZero(tx.amount ?? tx.debit ?? tx.credit);

/**
 * Why a transaction is not booked at all, or null when it is. Checked before
 * any account is resolved, so a duplicate never opens a cash account.
 * Duplicates would count the money twice; an unconfirmed row does not count
 * anywhere until the user approves it, and is booked then.
 */
export function skipReason(tx: TransactionFacts): SkipReason | null {
  if (tx.isDuplicate) {
    return 'duplicate';
  }
  if (!tx.isVerified) {
    return 'unconfirmed';
  }
  return grossMinor(tx) === 0 ? 'zero_amount' : null;
}

/**
 * The legs of one transaction.
 *
 * Tax: the stored `taxAmount` is the rounded figure, and the net leg is the
 * gross minus that — never an independently rounded net — so the entry
 * balances to the cent by construction. Reverse charge (tax zero, notional
 * set) is self-assessed on a purchase: VAT receivable and VAT payable by the
 * same amount, leaving cash and the expense untouched.
 */
export function transactionLegs(tx: TransactionFacts, accounts: TransactionAccounts): LegsOrSkip {
  const skip = skipReason(tx);
  if (skip) {
    return { skip };
  }

  const gross = grossMinor(tx);
  const tax = minorOrZero(tx.taxAmount);
  const net = gross - tax;
  const analytics = { categoryId: tx.categoryId, branchId: tx.branchId };

  const legs: Leg[] =
    tx.transactionType === 'expense'
      ? [
          { accountId: accounts.counterpart, side: 'debit', amountMinor: net, ...analytics },
          { accountId: accounts.vatReceivable, side: 'debit', amountMinor: tax, ...analytics },
          { accountId: accounts.cash, side: 'credit', amountMinor: gross, ...analytics },
        ]
      : [
          { accountId: accounts.cash, side: 'debit', amountMinor: gross, ...analytics },
          { accountId: accounts.counterpart, side: 'credit', amountMinor: net, ...analytics },
          { accountId: accounts.vatPayable, side: 'credit', amountMinor: tax, ...analytics },
        ];

  const notional = minorOrZero(tx.taxNotionalAmount);
  if (tx.transactionType === 'expense' && tx.taxReverseCharge && tax === 0 && notional !== 0) {
    legs.push(
      { accountId: accounts.vatReceivable, side: 'debit', amountMinor: notional, ...analytics },
      { accountId: accounts.vatPayable, side: 'credit', amountMinor: notional, ...analytics },
    );
  }

  return { legs: normalise(legs) };
}

/** Dr cash / Cr opening-balance equity; an overdrawn start books the other way round. */
export function openingBalanceLegs(
  balanceStart: number | string | null,
  cashAccountId: string,
  openingEquityAccountId: string,
): Leg[] {
  const amount = minorOrZero(balanceStart);
  return normalise([
    { accountId: cashAccountId, side: 'debit', amountMinor: amount },
    { accountId: openingEquityAccountId, side: 'credit', amountMinor: amount },
  ]);
}

const signed = (side: Side, amount: number): number => (side === 'debit' ? amount : -amount);

/**
 * Converts single-currency legs to base currency.
 *
 * Each leg is converted and rounded on its own, which can leave the base
 * amounts a cent or two apart even though the document amounts balance. The
 * difference goes to the largest line of the side split into several legs,
 * where it distorts least. The database refuses an unbalanced entry anyway;
 * this makes sure we never offer one.
 */
export function toBaseLines(
  legs: Leg[],
  currency: string,
  baseCurrency: string,
  rate: number,
): BaseLine[] {
  const docImbalance = legs.reduce((sum, leg) => sum + signed(leg.side, leg.amountMinor), 0);
  if (legs.length < 2 || docImbalance !== 0) {
    throw new Error(
      `Refusing to convert an unbalanced set of legs (off by ${docImbalance} minor units)`,
    );
  }

  const sameCurrency = currency === baseCurrency;
  const fxRate = sameCurrency ? 1 : Number(rate.toFixed(8));
  if (!(Number.isFinite(fxRate) && fxRate > 0)) {
    throw new Error(`Invalid exchange rate ${rate} for ${currency}->${baseCurrency}`);
  }

  const lines: BaseLine[] = legs.map(leg => ({
    ...leg,
    currency,
    fxRate,
    baseMinor: sameCurrency ? leg.amountMinor : roundHalfAwayFromZero(leg.amountMinor * fxRate),
  }));

  const baseImbalance = lines.reduce((sum, line) => sum + signed(line.side, line.baseMinor), 0);
  if (baseImbalance !== 0) {
    // The side split into several legs absorbs it (expense + VAT against one
    // cash leg), so the cash leg keeps the exact conversion of the money moved.
    const debits = lines.filter(line => line.side === 'debit');
    const credits = lines.filter(line => line.side === 'credit');
    const splitSide = debits.length >= credits.length ? debits : credits;
    const largest = splitSide.reduce((max, line) => (line.baseMinor > max.baseMinor ? line : max));
    largest.baseMinor += largest.side === 'debit' ? -baseImbalance : baseImbalance;
    if (largest.baseMinor < 0) {
      throw new Error(`Rounding correction of ${baseImbalance} exceeds the largest line`);
    }
  }

  return lines;
}

/** The same lines with sides swapped: a reversal cancels its original exactly. */
export function reversedLines(lines: BaseLine[]): BaseLine[] {
  return lines.map(line => ({ ...line, side: line.side === 'debit' ? 'credit' : 'debit' }));
}

/** Column values for a `journal_lines` row. Decimals go out as strings, exact. */
export function toLineColumns(line: BaseLine) {
  const amount = fromMinor(line.amountMinor).toFixed(2);
  const base = fromMinor(line.baseMinor).toFixed(2);
  return {
    accountId: line.accountId,
    debit: line.side === 'debit' ? amount : '0.00',
    credit: line.side === 'credit' ? amount : '0.00',
    currency: line.currency,
    baseDebit: line.side === 'debit' ? base : '0.00',
    baseCredit: line.side === 'credit' ? base : '0.00',
    fxRate: line.fxRate.toFixed(8),
    categoryId: line.categoryId ?? null,
    branchId: line.branchId ?? null,
  };
}

/** Reads a stored `journal_lines` row back into a BaseLine, for comparison and reversal. */
export function fromLineColumns(row: {
  accountId: string;
  debit: string | number;
  credit: string | number;
  currency: string;
  baseDebit: string | number;
  baseCredit: string | number;
  fxRate: string | number;
  categoryId: string | null;
  branchId: string | null;
}): BaseLine {
  const debit = toMinor(row.debit);
  const credit = toMinor(row.credit);
  // A revaluation line has no document amount; its base amount gives the side.
  const side: Side = debit > 0 || (credit === 0 && toMinor(row.baseDebit) > 0) ? 'debit' : 'credit';
  return {
    accountId: row.accountId,
    side,
    amountMinor: side === 'debit' ? debit : credit,
    currency: row.currency,
    baseMinor: side === 'debit' ? toMinor(row.baseDebit) : toMinor(row.baseCredit),
    fxRate: Number(row.fxRate),
    categoryId: row.categoryId,
    branchId: row.branchId,
  };
}

/**
 * Whether two line sets book the same thing, in any order. Lets re-posting an
 * unchanged transaction be a no-op instead of a reversal pair.
 */
export function sameLines(a: BaseLine[], b: BaseLine[]): boolean {
  const key = (line: BaseLine) =>
    [
      line.accountId,
      line.side,
      line.amountMinor,
      line.currency,
      line.baseMinor,
      line.fxRate.toFixed(8),
      line.categoryId ?? '',
      line.branchId ?? '',
    ].join('|');
  const left = a.map(key).sort();
  const right = b.map(key).sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** A manual line as entered: any currency, amount in minor units. */
export interface ManualLeg extends Leg {
  currency: string;
}

/**
 * Base amounts for a manual entry. Single-currency lines that balance get the
 * same treatment as a transaction (rounding residue absorbed, so a USD entry
 * that balances in USD balances in base too). Mixed currencies are converted
 * line by line and may well not balance: an exchange between two cash
 * accounts rarely happens at the reference rate, and the difference is
 * something the user books explicitly (FX gain or loss), not something we hide.
 */
export function manualBaseLines(
  legs: ManualLeg[],
  baseCurrency: string,
  rateOf: (currency: string) => number,
): BaseLine[] {
  const currencies = new Set(legs.map(leg => leg.currency));
  const docBalanced = legs.reduce((sum, leg) => sum + signed(leg.side, leg.amountMinor), 0) === 0;
  if (currencies.size === 1 && legs.length >= 2 && docBalanced) {
    const [currency] = currencies;
    return toBaseLines(legs, currency, baseCurrency, rateOf(currency) ?? Number.NaN);
  }

  return legs.map(leg => {
    const sameCurrency = leg.currency === baseCurrency;
    const rate = sameCurrency ? 1 : rateOf(leg.currency);
    const fxRate = typeof rate === 'number' ? Number(rate.toFixed(8)) : Number.NaN;
    if (!(Number.isFinite(fxRate) && fxRate > 0)) {
      throw new Error(`Invalid exchange rate for ${leg.currency}->${baseCurrency}`);
    }
    return {
      ...leg,
      fxRate,
      baseMinor: sameCurrency ? leg.amountMinor : roundHalfAwayFromZero(leg.amountMinor * fxRate),
    };
  });
}

/** Base debits minus base credits, in minor units. Zero means the entry can be posted. */
export function baseDifference(lines: BaseLine[]): number {
  return lines.reduce((sum, line) => sum + signed(line.side, line.baseMinor), 0);
}

/** What a foreign-currency balance holds on the revaluation day, from its booked lines. */
export interface ForeignBalance {
  accountId: string;
  currency: string;
  /** Debits minus credits in the balance's own currency. */
  docMinor: number;
  /** Debits minus credits in the base currency, at the rates it was booked at. */
  baseMinor: number;
}

/**
 * Lines that bring foreign-currency balances to their value at `rateOf` —
 * one base-only line per balance that moved, against FX gain or FX loss.
 *
 * One formula serves assets and liabilities alike: a liability's balance is
 * negative, so a stronger foreign currency makes it more negative, and the
 * base-only credit that follows lands on FX loss as it should. Revaluations
 * are cumulative: each adjusts to the rate of its own day whatever the last
 * one booked, so none needs reversing the next morning.
 */
export function revaluationLines(
  balances: ForeignBalance[],
  rateOf: (currency: string) => number,
  baseCurrency: string,
  accounts: { fxGain: string; fxLoss: string },
): BaseLine[] {
  const lines: BaseLine[] = [];
  let gainMinor = 0;
  let lossMinor = 0;
  for (const balance of balances) {
    const fxRate = Number(rateOf(balance.currency).toFixed(8));
    if (!(Number.isFinite(fxRate) && fxRate > 0)) {
      throw new Error(`Invalid exchange rate for ${balance.currency}->${baseCurrency}`);
    }
    const delta = roundHalfAwayFromZero(balance.docMinor * fxRate) - balance.baseMinor;
    if (delta === 0) {
      continue;
    }
    lines.push({
      accountId: balance.accountId,
      side: delta > 0 ? 'debit' : 'credit',
      amountMinor: 0,
      currency: balance.currency,
      baseMinor: Math.abs(delta),
      fxRate,
    });
    if (delta > 0) {
      gainMinor += delta;
    } else {
      lossMinor -= delta;
    }
  }
  const counter = (accountId: string, side: Side, amountMinor: number): BaseLine => ({
    accountId,
    side,
    amountMinor,
    currency: baseCurrency,
    baseMinor: amountMinor,
    fxRate: 1,
  });
  if (gainMinor > 0) {
    lines.push(counter(accounts.fxGain, 'credit', gainMinor));
  }
  if (lossMinor > 0) {
    lines.push(counter(accounts.fxLoss, 'debit', lossMinor));
  }
  return lines;
}
