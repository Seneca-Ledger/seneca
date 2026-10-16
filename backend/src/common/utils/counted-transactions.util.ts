import { IsNull } from 'typeorm';

/**
 * Which transactions count in any number Lumio shows (balances, totals,
 * budgets, goals, forecasts, reports, tax, insights): rows a person confirmed
 * (an imported, synced or scanned row waits in Review until approved), that
 * are not suspected duplicates and are not on a statement in the trash.
 *
 * Transfers between the user's own accounts are NOT excluded here: a wallet
 * balance needs them, an income/expense figure does not, so each caller that
 * sums income or spending adds `transferPairId IS NULL` itself.
 *
 * Every aggregate over transactions goes through one of these, so the rule can
 * be found (and audited) by searching for this file's names.
 */

/** For query builders, by property path: `onlyCounted(query, 't')`. */
export function onlyCounted<T extends { andWhere(where: string): T }>(query: T, alias: string): T {
  return query
    .andWhere(`${alias}.isVerified = true`)
    .andWhere(`${alias}.isDuplicate = false`)
    .andWhere(
      `NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = ${alias}.statementId AND trashed.deleted_at IS NOT NULL)`,
    );
}

/** For raw SQL over the `transactions` table, by column name: `AND ${countedSql('t')}`. */
export function countedSql(alias: string): string {
  return `(${alias}.is_verified = true AND ${alias}.is_duplicate = false AND NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = ${alias}.statement_id AND trashed.deleted_at IS NOT NULL))`;
}

/**
 * For `find()` options: `where: countedWhere({ workspaceId })`. Two
 * alternatives, since "no statement, or a statement not in the trash" needs
 * an OR: rows without a statement, and rows whose statement is not trashed.
 */
export function countedWhere<W extends object>(where: W) {
  const base = { ...where, isVerified: true, isDuplicate: false };
  return [
    { ...base, statementId: IsNull() },
    { ...base, statement: { deletedAt: IsNull() } },
  ];
}

/** Statements whose rows are not yet (or never) real: still being read, or failed. */
const UNREAD_STATEMENT_STATUSES = "'error', 'processing'";

/**
 * Which counted rows are money earned or spent, for every income and spending
 * figure (dashboard, reports, forecast, budgets, goals, insights). On top of
 * `onlyCounted`:
 * - a row from any source counts, statement or not (a cash payment, an approved
 *   receipt), but not one on a statement still processing or that failed;
 * - a crypto row counts only when it settles a bill or a receivable: a swap or
 *   a move between one's own wallets is neither income nor spending, and the
 *   crypto card shows those flows on its own.
 *
 * Transfers between own accounts are left to the caller (`transferPairId IS
 * NULL`), as for `onlyCounted`: a few views show them on purpose. The
 * workspace filter is the caller's too, on the transaction itself: a row
 * without a statement has no statement to carry it.
 */
export function onlyFlows<T extends { andWhere(where: string): T }>(
  query: T,
  alias: string,
  /** Data-health counts look at what still waits too: everything but the confirmation check. */
  { includeUnconfirmed = false }: { includeUnconfirmed?: boolean } = {},
): T {
  const counted = includeUnconfirmed
    ? query
        .andWhere(`${alias}.isDuplicate = false`)
        .andWhere(
          `NOT EXISTS (SELECT 1 FROM statements trashed WHERE trashed.id = ${alias}.statementId AND trashed.deleted_at IS NOT NULL)`,
        )
    : onlyCounted(query, alias);
  return counted
    .andWhere(
      `NOT EXISTS (SELECT 1 FROM statements unread WHERE unread.id = ${alias}.statementId AND unread.status IN (${UNREAD_STATEMENT_STATUSES}))`,
    )
    .andWhere(settlesIfCrypto(`${alias}.cryptoWalletId`, `${alias}.id`));
}

/** `onlyFlows` for raw SQL over the `transactions` table: `AND ${flowsSql('t')}`. */
export function flowsSql(alias: string): string {
  return `(${countedSql(alias)} AND NOT EXISTS (SELECT 1 FROM statements unread WHERE unread.id = ${alias}.statement_id AND unread.status IN (${UNREAD_STATEMENT_STATUSES})) AND ${settlesIfCrypto(`${alias}.crypto_wallet_id`, `${alias}.id`)})`;
}

function settlesIfCrypto(cryptoWallet: string, id: string): string {
  return `(${cryptoWallet} IS NULL OR EXISTS (SELECT 1 FROM payable_payments settled WHERE settled.transaction_id = ${id}) OR EXISTS (SELECT 1 FROM payables settled_bill WHERE settled_bill.linked_transaction_id = ${id} AND settled_bill.deleted_at IS NULL))`;
}
