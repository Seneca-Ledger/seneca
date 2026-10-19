import type { EntityManager } from 'typeorm';
import { type PayeeKeyInput, payeeKeyOf, payeeNameOf } from '../../common/utils/payee-key.util';

/**
 * The payee a descriptor belongs to in this workspace, creating it (named
 * after the descriptor) the first time the descriptor is seen. `null` when the
 * descriptor names nobody ("Invoice 4711", a bare reference number).
 *
 * Runs on whatever manager the caller writes with, so a payee created for an
 * import lands in the import's transaction and goes away if it rolls back.
 */
export async function resolvePayeeId(
  manager: EntityManager,
  workspaceId: string,
  descriptor: PayeeKeyInput,
): Promise<string | null> {
  const payeeKey = payeeKeyOf(descriptor);
  if (!payeeKey) {
    return null;
  }

  const existing = await findPayeeId(manager, workspaceId, payeeKey);
  if (existing) {
    return existing;
  }

  const [created] = await manager.query(
    'INSERT INTO payees (workspace_id, name) VALUES ($1, $2) RETURNING id',
    [workspaceId, payeeNameOf(descriptor) ?? payeeKey],
  );
  const claimed = await manager.query(
    `INSERT INTO payee_aliases (workspace_id, payee_key, payee_id) VALUES ($1, $2, $3)
     ON CONFLICT DO NOTHING RETURNING payee_id`,
    [workspaceId, payeeKey, created.id],
  );
  if (claimed.length) {
    return created.id;
  }

  // Another writer created this payee between the lookup and the insert.
  await manager.query('DELETE FROM payees WHERE id = $1', [created.id]);
  return findPayeeId(manager, workspaceId, payeeKey);
}

export async function findPayeeId(
  manager: EntityManager,
  workspaceId: string,
  payeeKey: string,
): Promise<string | null> {
  const [alias] = await manager.query(
    'SELECT payee_id FROM payee_aliases WHERE workspace_id = $1 AND payee_key = $2',
    [workspaceId, payeeKey],
  );
  return alias?.payee_id ?? null;
}
