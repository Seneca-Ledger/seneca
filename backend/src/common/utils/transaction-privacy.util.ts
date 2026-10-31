import type { Transaction } from '../../entities/transaction.entity';

/** What a non-owner reads instead of the merchant and the purpose. */
export const PRIVATE_PLACEHOLDER = '—';

/** The fields that would say what a private row was. */
const REDACTED_FIELDS = [
  'counterpartyName',
  'paymentPurpose',
  'documentNumber',
  'counterpartyBin',
  'counterpartyAccount',
  'counterpartyBank',
  'counterpartyVatId',
  'vendorNormalized',
  // The normalised merchant the payee is keyed on: the merchant, lower-cased.
  'payeeKey',
  'categoryHint',
  'article',
  'comments',
] as const satisfies ReadonlyArray<keyof Transaction>;

/** Can this viewer read the row as it really is? */
export function canReadPrivate(
  row: Pick<Transaction, 'isPrivate' | 'ownerMemberId'>,
  viewerMemberId: string | null,
): boolean {
  return !row.isPrivate || (viewerMemberId !== null && row.ownerMemberId === viewerMemberId);
}

/**
 * Blanks out what a private row was, for someone who does not own it.
 *
 * The date, the amount and the category are deliberately left alone: the
 * category is already the workspace's `Private` one for everybody, and the
 * amount has to stay or the household's totals stop matching the rows they are
 * made of — which is the subtraction that would give the hidden row away.
 *
 * Mutates and returns the row: these come straight off a query and are not
 * shared with anything else.
 */
export function redactPrivate<T extends Pick<Transaction, 'isPrivate' | 'ownerMemberId'>>(
  row: T,
  viewerMemberId: string | null,
): T {
  if (canReadPrivate(row, viewerMemberId)) {
    return row;
  }
  const target: Record<string, unknown> = row;
  for (const field of REDACTED_FIELDS) {
    if (target[field] !== undefined && target[field] !== null) {
      target[field] = PRIVATE_PLACEHOLDER;
    }
  }
  // The category it had before is the owner's business, and so is the link.
  target.privateCategoryId = null;
  target.privateCategory = null;
  // The payee names the merchant as plainly as the descriptor does.
  target.payeeId = null;
  target.payee = null;
  // A closed list has no placeholder: how the money moved is cut like the purpose it came from.
  target.paymentType = null;
  return row;
}

/** The same, for a page of rows. */
export function redactPrivateRows<T extends Pick<Transaction, 'isPrivate' | 'ownerMemberId'>>(
  rows: T[],
  viewerMemberId: string | null,
): T[] {
  for (const row of rows) {
    redactPrivate(row, viewerMemberId);
  }
  return rows;
}

/**
 * The parameter the SQL helpers below read the viewer's member id from. Bind
 * it to `null` for output nobody in particular reads (a scheduled run, a
 * filing): then every private row counts as somebody else's.
 */
export const PRIVACY_VIEWER_PARAM = 'privacyViewerId';

/**
 * `canReadPrivate` as SQL over the `transactions` row aliased `alias`, for a
 * WHERE clause or a CASE. Uses column names, so it works in raw SQL and in a
 * query builder alike; `param` is how that query spells the viewer's id
 * (`:privacyViewerId` by default, or a positional `$n`).
 */
export function readablePrivateSql(alias: string, param = `:${PRIVACY_VIEWER_PARAM}`): string {
  return `(${alias}.is_private = false OR ${alias}.owner_member_id = ${param})`;
}

/**
 * `expr` for a row the viewer may read, the placeholder for anybody else's
 * private row — for aggregates that name the merchant or the purpose. The row
 * itself still counts, under the placeholder, so the totals do not change
 * with who is asking.
 */
export function redactedSql(
  alias: string,
  expr: string,
  param = `:${PRIVACY_VIEWER_PARAM}`,
): string {
  return `(CASE WHEN ${readablePrivateSql(alias, param)} THEN ${expr} ELSE '${PRIVATE_PLACEHOLDER}' END)`;
}
