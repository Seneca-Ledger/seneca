import type { EntityManager } from 'typeorm';
import { WorkspaceServiceSettingsKey } from '../../entities/workspace-service-settings.entity';

/**
 * The expense category the workspace books its tax payments to.
 *
 * Set in the tax-reserve settings; until the user picks one, the seeded
 * top-level "Taxes" category. NULL when there is neither.
 */
export async function taxPaymentsCategoryId(
  manager: EntityManager,
  workspaceId: string,
): Promise<string | null> {
  const [setting] = await manager.query(
    'SELECT config FROM workspace_service_settings WHERE workspace_id = $1 AND key = $2',
    [workspaceId, WorkspaceServiceSettingsKey.TAX_RESERVE],
  );
  const configured = (setting?.config ?? {}) as { paymentsCategoryId?: string | null };
  if (configured.paymentsCategoryId !== undefined) {
    return configured.paymentsCategoryId;
  }

  const [seeded] = await manager.query(
    `SELECT id FROM categories
      WHERE workspace_id = $1 AND type = 'expense' AND parent_id IS NULL AND LOWER(name) = 'taxes'
      LIMIT 1`,
    [workspaceId],
  );
  return seeded?.id ?? null;
}
