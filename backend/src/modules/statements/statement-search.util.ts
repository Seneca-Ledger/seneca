/**
 * Free-text search for the documents list: what a row stands for is its file,
 * its bank and category, and the merchants, descriptions, categories, amounts
 * and notes of the transactions in it.
 *
 * Private transactions are left out, so a search cannot reveal what another
 * member keeps to themselves through which documents it turns up.
 */

const AMOUNT_PATTERN = /^\d[\d ]*(?:[.,](\d{1,2}))?$/;

/**
 * "12" matches 12.49, "12.5" matches 12.57, "12.50" only 12.50: the amount is
 * compared to as many decimals as were typed. "1 200,50" reads as 1200.50.
 */
export function parseSearchAmount(search: string): { value: string; scale: number } | null {
  const match = AMOUNT_PATTERN.exec(search);
  if (!match) {
    return null;
  }
  return {
    value: search.replace(/ /g, '').replace(',', '.'),
    scale: match[1]?.length ?? 0,
  };
}

/**
 * Expects statements aliased as `statement` and their category joined as
 * `category`. Columns are spelled raw: TypeORM rewrites `alias.property` only
 * when a space or bracket follows it, so a property name before a line break
 * reaches Postgres as is and fails.
 */
export function buildStatementSearchClause(rawSearch: string): {
  clause: string;
  params: Record<string, string | number>;
} | null {
  const search = rawSearch.trim();
  if (!search) {
    return null;
  }
  const amount = parseSearchAmount(search);
  const amountIn = (columns: string[]): string =>
    amount
      ? ` OR CAST(:searchAmount AS numeric) IN (${columns
          .map(column => `TRUNC(${column}, CAST(:searchScale AS int))`)
          .join(', ')})`
      : '';

  const clause = `(
    statement.fileName ILIKE :search OR
    CAST(statement.bankName AS text) ILIKE :search OR
    COALESCE(category.name, '') ILIKE :search OR
    EXISTS (
      SELECT 1 FROM notes sn
      WHERE sn.statement_id = statement.id
        AND sn.workspace_id = statement.workspace_id
        AND sn.body ILIKE :search
    ) OR
    EXISTS (
      SELECT 1 FROM transactions st
      LEFT JOIN categories sc ON sc.id = st.category_id
      WHERE st.statement_id = statement.id
        AND st.workspace_id = statement.workspace_id
        AND st.is_private = false
        AND (
          st.counterparty_name ILIKE :search OR
          st.payment_purpose ILIKE :search OR
          COALESCE(sc.name, '') ILIKE :search OR
          EXISTS (
            SELECT 1 FROM notes tn
            WHERE tn.transaction_id = st.id
              AND tn.workspace_id = st.workspace_id
              AND tn.body ILIKE :search
          )${amountIn(['ABS(st.amount)', 'st.debit', 'st.credit'])}
        )
    )${amountIn(['statement.total_debit', 'statement.total_credit'])}
  )`;

  return {
    clause,
    params: {
      search: `%${search}%`,
      ...(amount ? { searchAmount: amount.value, searchScale: amount.scale } : {}),
    },
  };
}
