import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { AuthenticatedRequest } from '../../../common/interfaces/authenticated-request.interface';
import {
  ActorType,
  AuditAction,
  type AuditEventDiff,
  type EntityType,
  Severity,
} from '../../../entities/audit-event.entity';
import { AuditService } from '../audit.service';
import { AUDIT_METADATA_KEY, type AuditOptions } from '../decorators/audit.decorator';

interface AuditMetadata extends AuditOptions {
  entityType: EntityType;
}

/**
 * One side of a before/after diff is a record of fields. An answer that is not
 * one (the tags a transaction now has) goes under `value`, so the audit trail
 * and its readers deal with one shape.
 */
function asDiffSide(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'object' && !Array.isArray(value))
    return Object.fromEntries(Object.entries(value));
  return { value };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor<unknown, unknown> {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.getAllAndOverride<AuditMetadata>(AUDIT_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const actorId = request.user?.id || null;
    const workspaceId = request.workspace?.id || (request.headers?.['x-workspace-id'] as string);
    const action = this.mapMethodToAction(request.method);
    const entityIdFromParams = request.params?.id || request.params?.entityId || null;
    const bodySnapshot = metadata.includeBody ? request.body : null;

    return next.handle().pipe(
      tap({
        next: response => {
          const responseData =
            typeof response === 'object' && response !== null && 'data' in response
              ? response.data
              : undefined;

          if (!action) {
            return;
          }
          const entityId =
            entityIdFromParams ||
            this.extractEntityId(response) ||
            this.extractEntityId(responseData);

          if (!entityId) {
            this.logger.debug('Audit event skipped: entityId not resolved');
            return;
          }

          const diff: AuditEventDiff | null = metadata.includeDiff
            ? {
                before: asDiffSide(bodySnapshot),
                after: asDiffSide(response),
              }
            : null;

          // Audit: automatic controller-level event capture for annotated routes.
          void this.auditService
            .createEvent({
              workspaceId: workspaceId || null,
              actorType: ActorType.USER,
              actorId,
              entityType: metadata.entityType,
              entityId,
              action,
              diff,
              meta: {
                path: request.path,
                method: request.method,
              },
              severity: metadata.severity ?? Severity.INFO,
              isUndoable: metadata.isUndoable,
            })
            .catch(error => {
              this.logger.warn(`Audit event failed: ${error?.message || error}`);
            });
        },
      }),
    );
  }

  private mapMethodToAction(method?: string | null): AuditAction | null {
    switch ((method || '').toUpperCase()) {
      case 'POST':
        return AuditAction.CREATE;
      case 'PUT':
      case 'PATCH':
        return AuditAction.UPDATE;
      case 'DELETE':
        return AuditAction.DELETE;
      default:
        return null;
    }
  }

  private extractEntityId(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }
    if ('id' in payload && typeof payload.id === 'string') {
      return payload.id;
    }
    return null;
  }
}
