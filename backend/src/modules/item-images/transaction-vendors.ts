import type { EntityManager } from 'typeorm';
import type { ItemVendor } from '../../contracts';

type Row = { transactionId: string; name: string; domain: string | null };

/**
 * The subscription each transaction paid, for its vendor's mark: the charge it
 * was matched as, or else the subscription its payee is filed under. Callers
 * pass only ids the viewer may read; every table is held to the workspace.
 */
export async function vendorsOfTransactions(
  manager: EntityManager,
  workspaceId: string,
  transactionIds: string[],
): Promise<ItemVendor[]> {
  if (transactionIds.length === 0) {
    return [];
  }
  const charged: Row[] = await manager.query(
    `SELECT DISTINCT ON (c.transaction_id)
            c.transaction_id AS "transactionId", s.vendor_name AS name, s.vendor_domain AS domain
       FROM subscription_charges c
       JOIN subscriptions s ON s.id = c.subscription_id AND s.workspace_id = $1
      WHERE c.workspace_id = $1 AND c.transaction_id = ANY($2::uuid[])
      ORDER BY c.transaction_id, c.charge_date DESC`,
    [workspaceId, transactionIds],
  );
  const found = new Set(charged.map(row => row.transactionId));
  const rest = transactionIds.filter(id => !found.has(id));
  const byPayee: Row[] =
    rest.length === 0
      ? []
      : await manager.query(
          `SELECT DISTINCT ON (t.id)
                  t.id AS "transactionId", s.vendor_name AS name, s.vendor_domain AS domain
             FROM transactions t
             JOIN subscription_payees sp ON sp.payee_id = t.payee_id AND sp.workspace_id = $1
             JOIN subscriptions s ON s.id = sp.subscription_id AND s.workspace_id = $1
            WHERE t.workspace_id = $1 AND t.id = ANY($2::uuid[])
            ORDER BY t.id, (s.status = 'active') DESC, s.updated_at DESC`,
          [workspaceId, rest],
        );
  return [...charged, ...byPayee].map(row => ({
    subjectId: row.transactionId,
    name: row.name,
    domain: row.domain,
  }));
}
