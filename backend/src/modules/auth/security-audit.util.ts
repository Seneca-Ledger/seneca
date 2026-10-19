import type { Logger } from '@nestjs/common';
import { ActorType } from '../../entities/audit-event.entity';
import type { AuditService } from '../audit/audit.service';
import type { CreateAuditEventDto } from '../audit/interfaces/audit-event.interface';

export type SecurityAuditEvent = Omit<CreateAuditEventDto, 'actorType' | 'isUndoable'>;

/**
 * Writes a security event to the audit log without ever failing the operation
 * it describes. The log is only ever read per workspace, so an event without
 * one would be invisible: it is skipped instead of stored.
 *
 * Callers build `diff`/`meta` from an explicit field whitelist — passwords,
 * hashes, 2FA secrets, recovery codes, key material and tokens never go in.
 */
export async function recordSecurityEvent(
  auditService: AuditService,
  logger: Logger,
  event: SecurityAuditEvent,
): Promise<void> {
  if (!event.workspaceId) {
    logger.debug(
      `Skipped ${event.entityType} ${event.action} audit event for ${event.entityId}: no workspace`,
    );
    return;
  }

  try {
    await auditService.createEvent({ ...event, actorType: ActorType.USER });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Audit event failed for ${event.entityType} ${event.entityId}: ${message}`);
  }
}
