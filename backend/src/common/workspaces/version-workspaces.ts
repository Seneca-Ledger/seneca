import type { EntityManager } from 'typeorm';
import { Workspace, WorkspaceKind } from '../../entities/workspace.entity';

/**
 * A past version (`workspaces.kind = 'version'`) is a copy of a workspace's
 * books as they were on a date. It carries the source's invoices, payables,
 * statements, schedules and reminders, so any background job that acted on it
 * would mail clients, issue invoices, purge files or notify people a second
 * time. Every job that walks many workspaces filters through one of these, so
 * the rule can be found by searching for this file's names.
 */

/** For `find()` options, on the entity's `workspace` relation: `where: { workspace: STANDARD_WORKSPACE }`. */
export const STANDARD_WORKSPACE = { kind: WorkspaceKind.STANDARD };

/**
 * For SQL and query builders: `andWhere(notInVersionWorkspace('payable.workspaceId'))`.
 * A row without a workspace passes; only a version is left out.
 */
export function notInVersionWorkspace(workspaceIdColumn: string): string {
  return `NOT EXISTS (SELECT 1 FROM workspaces version_ws WHERE version_ws.id = ${workspaceIdColumn} AND version_ws.kind = '${WorkspaceKind.VERSION}')`;
}

/** For a job handed one workspace: whether to leave it alone. */
export async function isVersionWorkspace(
  manager: EntityManager,
  workspaceId: string | null | undefined,
): Promise<boolean> {
  if (!workspaceId) {
    return false;
  }
  return manager.exists(Workspace, { where: { id: workspaceId, kind: WorkspaceKind.VERSION } });
}
