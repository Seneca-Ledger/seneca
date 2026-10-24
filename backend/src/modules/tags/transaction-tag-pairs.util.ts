/**
 * Every (transaction_id, tag_id) pair of the workspace bound to `:workspaceId`:
 * the transaction's own tags, its statement's, and those of a receipt attached
 * to it (directly, or through the statement its scan created). UNION drops the
 * repeats, so a transaction counts once per tag however it got it.
 *
 * Only the tag side is scoped here; join the transactions with their own
 * filters (workspace, counted flows, dates) on `transaction_id`.
 */
export const TRANSACTION_TAG_PAIRS_SQL = `
  SELECT tt.transaction_id, tt.tag_id
    FROM transaction_tags tt
    JOIN tags tg ON tg.id = tt.tag_id AND tg.workspace_id = :workspaceId
  UNION
  SELECT tx.id, st.tag_id
    FROM transactions tx
    JOIN statement_tags st ON st.statement_id = tx.statement_id
    JOIN tags tg ON tg.id = st.tag_id AND tg.workspace_id = :workspaceId
   WHERE tx.workspace_id = :workspaceId
  UNION
  SELECT tx.id, rt.tag_id
    FROM transactions tx
    JOIN receipts r ON r.workspace_id = tx.workspace_id
     AND (r.transaction_id = tx.id OR (tx.statement_id IS NOT NULL AND r.statement_id = tx.statement_id))
    JOIN receipt_tags rt ON rt.receipt_id = r.id
    JOIN tags tg ON tg.id = rt.tag_id AND tg.workspace_id = :workspaceId
   WHERE tx.workspace_id = :workspaceId`;
