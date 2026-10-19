/**
 * Money as whole minor units (tiyin, cents, pence).
 *
 * Tax is the one place in this codebase where floating point is not good
 * enough: `100 * 12 / 112` leaves a tail, and a tail repeated across a
 * quarter's transactions shows up as a mismatch on a filed return. Every
 * calculation therefore runs on integers and converts back only at the edges.
 *
 * There is no decimal library here on purpose. Amounts are `decimal(15,2)` in
 * the database, so two decimal places is the whole problem, and JavaScript
 * integers are exact well past any amount this system will hold.
 */

const MINOR_UNITS_PER_MAJOR = 100;

/**
 * Rounds half away from zero, which is what money expects.
 *
 * `Math.round` rounds half *up* (-0.5 becomes -0), so a refund of −100.00 would
 * not be the exact mirror of a charge of 100.00. Off-by-a-cent asymmetry
 * between a sale and its refund is exactly the kind of thing that leaves a
 * return failing to reconcile.
 */
export function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/**
 * Major units -> minor units.
 *
 * Accepts the strings TypeORM hands back for `decimal` columns as well as
 * plain numbers. Inputs are assumed to carry at most two decimal places, which
 * the database column already guarantees; anything finer is rounded here
 * rather than silently truncated downstream.
 */
export function toMinor(amount: number | string): number {
  const value = typeof amount === 'string' ? Number(amount) : amount;

  if (!Number.isFinite(value)) {
    throw new Error(`Cannot convert ${JSON.stringify(amount)} to minor units`);
  }

  const minor = roundHalfAwayFromZero(value * MINOR_UNITS_PER_MAJOR);

  // Past this point integer arithmetic stops being exact, so fail loudly
  // rather than quietly returning a number that is nearly right.
  if (!Number.isSafeInteger(minor)) {
    throw new Error(`Amount ${value} is too large to represent exactly in minor units`);
  }

  return minor;
}

/** Minor units -> major units, for storing back into a `decimal(15,2)` column. */
export function fromMinor(minor: number): number {
  if (!Number.isInteger(minor)) {
    throw new Error(`Minor units must be a whole number, got ${minor}`);
  }

  return minor / MINOR_UNITS_PER_MAJOR;
}
