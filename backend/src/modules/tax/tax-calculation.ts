import { roundHalfAwayFromZero } from '../../common/utils/money.util';

/**
 * The tax engine's core arithmetic.
 *
 * Pure functions over integer minor units: no database, no injection, no
 * state. Everything that can go wrong with a tax figure goes wrong here, so
 * this is the part that is exhaustively tested.
 */

export interface TaxInput {
  /**
   * The amount on the document, in minor units. Gross when the rate is
   * inclusive, net when it is not. Negative for refunds and credit notes.
   */
  amountMinor: number;
  /** Percentage points, e.g. `12` for 12%. */
  rate: number;
  /**
   * Whether `amountMinor` already contains the tax. Bank statements and
   * receipts are gross, so this is the common case.
   */
  isInclusive: boolean;
  /** Cross-border B2B: the buyer accounts for the tax, the seller charges none. */
  isReverseCharge?: boolean;
}

export interface TaxBreakdown {
  netMinor: number;
  /** Tax actually charged. Always zero under reverse charge. */
  taxMinor: number;
  grossMinor: number;
  /**
   * What the tax would have been. Equal to `taxMinor` in the ordinary case,
   * and the figure a reverse-charge return reports on both sides so that the
   * two entries cancel.
   */
  notionalTaxMinor: number;
}

function assertValid({ amountMinor, rate }: TaxInput): void {
  if (!Number.isInteger(amountMinor)) {
    throw new Error(`Amount must be whole minor units, got ${amountMinor}`);
  }

  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error(`Tax rate must be between 0 and 100, got ${rate}`);
  }
}

/**
 * Splits an amount into net, tax and gross.
 *
 * The two paths differ in which figure is known:
 *
 *   inclusive   tax = gross × rate / (100 + rate),  net = gross − tax
 *   exclusive   tax = net × rate / 100,             gross = net + tax
 *
 * Only the tax is rounded. The third figure is always derived by addition or
 * subtraction, never rounded independently — rounding both ends is how
 * `net + tax === gross` quietly stops holding, and a return built on top of
 * that fails to reconcile by a few units with no obvious cause.
 */
export function computeTax(input: TaxInput): TaxBreakdown {
  assertValid(input);

  const { amountMinor, rate, isInclusive, isReverseCharge = false } = input;

  // Under reverse charge the invoice carries no tax at all, so the amount is
  // the net figure whatever the rate's inclusive flag says — there is nothing
  // inside it to extract.
  if (isReverseCharge) {
    return {
      netMinor: amountMinor,
      taxMinor: 0,
      grossMinor: amountMinor,
      notionalTaxMinor: roundHalfAwayFromZero((amountMinor * rate) / 100),
    };
  }

  const taxMinor = isInclusive
    ? roundHalfAwayFromZero((amountMinor * rate) / (100 + rate))
    : roundHalfAwayFromZero((amountMinor * rate) / 100);

  const netMinor = isInclusive ? amountMinor - taxMinor : amountMinor;
  const grossMinor = isInclusive ? amountMinor : amountMinor + taxMinor;

  return { netMinor, taxMinor, grossMinor, notionalTaxMinor: taxMinor };
}
