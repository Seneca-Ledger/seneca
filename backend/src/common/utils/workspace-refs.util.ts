import { NotFoundException } from '@nestjs/common';
import { type EntityManager, type EntityTarget, In } from 'typeorm';
import { Branch } from '../../entities/branch.entity';
import { Category } from '../../entities/category.entity';
import { Wallet } from '../../entities/wallet.entity';

/**
 * The workspace-scoped ids a transaction-shaped write can carry. An owner is a
 * membership, checked by `assertOwnerMemberInWorkspace`.
 */
export type WorkspaceRefs = {
  categoryId?: string | null;
  branchId?: string | null;
  walletId?: string | null;
};

type WorkspaceScoped = EntityTarget<{ id: string; workspaceId: string }>;

/** Whether every non-empty id names a row of `entity` in this workspace. */
export async function workspaceOwnsAll(
  manager: EntityManager,
  entity: WorkspaceScoped,
  ids: ReadonlyArray<string | null | undefined>,
  workspaceId: string,
): Promise<boolean> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) {
    return true;
  }
  const found = await manager.getRepository(entity).countBy({ id: In(unique), workspaceId });
  return found === unique.length;
}

/**
 * Rejects an id that belongs to another workspace before it is written. A UUID
 * check on the body only proves the shape of the string, and the foreign keys
 * on category/wallet/branch columns accept any workspace's row, so without this
 * a caller can point their own record at another tenant's — whose name then
 * comes back to them through the relation loads.
 *
 * ponytail: app-level check; a composite FK on (id, workspace_id) would
 * enforce it in the database, but that needs a migration over existing rows.
 */
export async function assertWorkspaceOwned(
  manager: EntityManager,
  entity: WorkspaceScoped,
  ids: ReadonlyArray<string | null | undefined>,
  workspaceId: string,
): Promise<void> {
  if (!(await workspaceOwnsAll(manager, entity, ids, workspaceId))) {
    throw new NotFoundException('Referenced record not found in this workspace');
  }
}

/** Every workspace-scoped reference a transaction-shaped body can carry. */
export async function assertWorkspaceRefs(
  manager: EntityManager,
  workspaceId: string,
  refs: WorkspaceRefs,
): Promise<void> {
  await Promise.all([
    assertWorkspaceOwned(manager, Category, [refs.categoryId], workspaceId),
    assertWorkspaceOwned(manager, Branch, [refs.branchId], workspaceId),
    assertWorkspaceOwned(manager, Wallet, [refs.walletId], workspaceId),
  ]);
}

/** The same check as a yes/no, for stored data that is skipped rather than refused. */
export async function workspaceOwnsRefs(
  manager: EntityManager,
  workspaceId: string,
  refs: WorkspaceRefs,
): Promise<boolean> {
  const owned = await Promise.all([
    workspaceOwnsAll(manager, Category, [refs.categoryId], workspaceId),
    workspaceOwnsAll(manager, Branch, [refs.branchId], workspaceId),
    workspaceOwnsAll(manager, Wallet, [refs.walletId], workspaceId),
  ]);
  return owned.every(Boolean);
}
