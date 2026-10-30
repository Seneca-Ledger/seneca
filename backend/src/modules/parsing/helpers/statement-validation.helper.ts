import type {
  ParseCheck,
  ParseCheckCode,
  ParsedTransaction,
} from '../interfaces/parsed-statement.interface';

/**
 * Why a statement is held for review: each reason a warning was raised for.
 * The codes are stable; the warnings' text is for people.
 */
export type ValidationReasonCode =
  | 'mixed_currencies'
  | 'balance_mismatch'
  | 'no_rows_kept'
  | 'rows_dropped'
  | 'nothing_extracted'
  | ParseCheckCode;

export interface BalanceCheck {
  expectedEnd?: number;
  actualEnd?: number;
  difference?: number;
  tolerance: number;
}

export interface StatementValidation {
  passed: boolean;
  warnings: string[];
  reasonCodes: ValidationReasonCode[];
  balanceCheck?: BalanceCheck;
}

/** More than this share of parsed rows rejected is a failed parse, not a few bad rows. */
const HIGH_DROP_RATIO_THRESHOLD = 0.5;

/**
 * Summing debit/credit across transactions only makes sense when they
 * share one currency — a statement whose rows carry different currency
 * codes (e.g. a generic CSV/XLSX with a per-row currency column) would
 * otherwise get compared against balanceEnd as if KZT and USD were the
 * same unit. Parsers that convert foreign amounts into the statement's
 * own currency (Hapoalim tracks the original via amountForeign instead)
 * already report one currency per row, so they're unaffected.
 */
function findMixedCurrencies(transactions: ParsedTransaction[]): string[] | null {
  const currencies = new Set(transactions.map(t => t.currency).filter((c): c is string => !!c));
  return currencies.size > 1 ? Array.from(currencies) : null;
}

const money = (value: number | undefined) => (value ?? 0).toFixed(2);

/** A failed check of the parser's own reading, as a warning a person can follow. */
function checkWarning({ code, detail = {} }: ParseCheck): string {
  const figures = `expected ${money(detail.expected)} got ${money(detail.actual)}`;
  switch (code) {
    case 'balance_chain':
      return `Balance chain broken at row ${detail.row} (${detail.date}): ${figures}`;
    case 'printed_totals':
      return `Printed totals mismatch: ${detail.side} ${figures}`;
    case 'section_totals':
      return `Section total mismatch: ${detail.side} ${figures}`;
    case 'printed_balances':
      return `Printed balance mismatch: ${detail.side} ${figures}`;
    case 'dates_in_period':
      return `Row ${detail.row} dated ${detail.date} falls outside the statement period`;
  }
}

/**
 * The balance check passes trivially whenever the bank statement didn't
 * include balances at all, or when every row happened to net to zero —
 * that's not the same as a good parse. A statement that produced zero
 * transactions, or dropped most of what it attempted, must not be reported
 * as COMPLETED just because there was nothing left to compare.
 */
function droppedRows(
  metadata: { balanceStart?: number | null; balanceEnd?: number | null },
  validCount: number,
  { rawCount, droppedCount }: { rawCount: number; droppedCount: number },
): { code: ValidationReasonCode; warning: string } | null {
  if (rawCount > 0 && validCount === 0) {
    return {
      code: 'no_rows_kept',
      warning: `All ${rawCount} parsed rows were rejected during validation — statement produced zero transactions`,
    };
  }
  if (rawCount > 0 && droppedCount / rawCount > HIGH_DROP_RATIO_THRESHOLD) {
    const percent = Math.round((droppedCount / rawCount) * 100);
    return {
      code: 'rows_dropped',
      warning: `${droppedCount} of ${rawCount} parsed rows were rejected during validation (${percent}%)`,
    };
  }
  // Both balances must be present to trust that zero transactions means a
  // genuinely empty period rather than a failed extraction — one balance
  // found and the other missing is still a partial failure.
  if (
    rawCount === 0 &&
    validCount === 0 &&
    (metadata.balanceStart == null || metadata.balanceEnd == null)
  ) {
    return {
      code: 'nothing_extracted',
      warning: 'No transactions or balances could be extracted from the statement',
    };
  }
  return null;
}

/**
 * Whether a parsed statement can be trusted: its balances reconcile, its rows
 * survived validation, and the parser's checks of its own reading passed.
 * Anything else holds it for review, with a reason code per warning.
 */
export function validateParsedStatement(
  metadata: { balanceStart?: number | null; balanceEnd?: number | null },
  transactions: ParsedTransaction[],
  options: {
    tolerance: number;
    dropInfo?: { rawCount: number; droppedCount: number };
    checks?: ParseCheck[];
  },
): StatementValidation {
  const warnings: string[] = [];
  const reasonCodes: ValidationReasonCode[] = [];
  const raise = (code: ValidationReasonCode, warning: string) => {
    reasonCodes.push(code);
    warnings.push(warning);
  };
  const debitSum = transactions.reduce((sum, t) => sum + (t.debit ?? 0), 0);
  const creditSum = transactions.reduce((sum, t) => sum + (t.credit ?? 0), 0);
  const mixedCurrencies = findMixedCurrencies(transactions);
  let balanceCheck: BalanceCheck | undefined;

  if (mixedCurrencies) {
    raise(
      'mixed_currencies',
      `Statement mixes multiple currencies (${mixedCurrencies.join(', ')}) — balance could not be automatically reconciled`,
    );
  } else if (metadata.balanceStart != null && metadata.balanceEnd != null) {
    const expectedEnd = metadata.balanceStart + creditSum - debitSum;
    const diff = Math.abs(expectedEnd - metadata.balanceEnd);
    balanceCheck = {
      expectedEnd,
      actualEnd: metadata.balanceEnd,
      difference: diff,
      tolerance: options.tolerance,
    };
    if (diff > options.tolerance) {
      raise(
        'balance_mismatch',
        `Balance mismatch: expected ${expectedEnd.toFixed(2)} got ${metadata.balanceEnd.toFixed(2)} (diff ${diff.toFixed(2)})`,
      );
    }
  }

  const dropped = options.dropInfo && droppedRows(metadata, transactions.length, options.dropInfo);
  if (dropped) {
    raise(dropped.code, dropped.warning);
  }

  for (const check of options.checks ?? []) {
    if (!check.passed) {
      raise(check.code, checkWarning(check));
    }
  }

  return { passed: warnings.length === 0, warnings, reasonCodes, balanceCheck };
}
