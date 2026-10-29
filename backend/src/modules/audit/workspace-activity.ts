import type { Repository } from 'typeorm';
import { type AuditEvent, EntityType } from '../../entities/audit-event.entity';

/**
 * What the household is allowed to see each other do.
 *
 * The full audit is an administrator's tool: it carries sign-ins, API keys,
 * member changes and the before/after of every edit. This is the other thing —
 * YNAB calls it Recent Moves — where two people sharing money can see that the
 * other one recategorised something, so nobody has to ask "did you change
 * this?".
 *
 * The line is drawn by entity: the money and the plan are the household's
 * business, security and administration are the owner's. Anything new falls
 * outside until it is put here deliberately.
 */
export const HOUSEHOLD_ENTITY_TYPES: readonly EntityType[] = [
  EntityType.TRANSACTION,
  EntityType.STATEMENT,
  EntityType.RECEIPT,
  EntityType.CATEGORY,
  EntityType.BUDGET,
  EntityType.GOAL,
  EntityType.SUBSCRIPTION,
  EntityType.WALLET,
  EntityType.PAYABLE,
  EntityType.INVOICE,
  EntityType.RULE,
];

/** One line of the feed: who did what to which thing, and when. */
export interface WorkspaceActivityEntry {
  id: string;
  actorName: string;
  actorType: string;
  action: string;
  entityType: string;
  entityId: string;
  /** English rendering; clients prefer `descriptionKey` in the viewer's locale. */
  description: string | null;
  descriptionKey: string | null;
  descriptionParams: Record<string, string | number> | null;
  createdAt: Date;
}

/**
 * Keeps the feed to who-did-what and drops everything an event carries about
 * the thing itself.
 *
 * No `diff` and no `meta`: a diff on a transaction holds its merchant and its
 * amount, and a private row is private from the rest of the household. The
 * description is safe by construction — it names changed *fields*, never their
 * values, and the entity name it can carry comes from `name`/`title`/`label`,
 * which a transaction has none of.
 */
export function toActivityEntry(event: AuditEvent): WorkspaceActivityEntry {
  const descriptor = event.meta?.auditDescription ?? null;
  return {
    id: event.id,
    actorName: event.actor?.name || event.actor?.email || event.actorLabel || '—',
    actorType: event.actorType,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    description: event.description,
    descriptionKey: descriptor?.key ?? null,
    descriptionParams: descriptor?.params ?? null,
    createdAt: event.createdAt,
  };
}

/**
 * The household's latest moves, newest first, at most `limit` (1..100); with
 * `month` (`YYYY-MM`) only that month's.
 */
export async function queryWorkspaceActivity(
  events: Repository<AuditEvent>,
  workspaceId: string,
  limit: number,
  month?: string,
): Promise<WorkspaceActivityEntry[]> {
  const query = events
    .createQueryBuilder('event')
    .leftJoinAndSelect('event.actor', 'actor')
    .where('event.workspaceId = :workspaceId', { workspaceId })
    .andWhere('event.entityType IN (:...entityTypes)', { entityTypes: HOUSEHOLD_ENTITY_TYPES });
  if (month) {
    const [year, monthNumber] = month.split('-').map(Number);
    query
      .andWhere('event.createdAt >= :monthStart', { monthStart: new Date(year, monthNumber - 1, 1) })
      .andWhere('event.createdAt < :monthEnd', { monthEnd: new Date(year, monthNumber, 1) });
  }
  const rows = await query
    .orderBy('event.createdAt', 'DESC')
    .take(Math.min(Math.max(limit, 1), 100))
    .getMany();
  return rows.map(toActivityEntry);
}
