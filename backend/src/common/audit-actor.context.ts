import { AsyncLocalStorage } from 'node:async_hooks';
import type { ActorType } from '../entities/audit-event.entity';

/**
 * Who is really acting in this request: an API key (MCP, scripts) rather than
 * the user whose key it rides on.
 *
 * Kept in async-local storage so every audit event written anywhere down the
 * call chain — controller interceptor or service — is signed the same way,
 * without threading an actor argument through every service method.
 */
export interface AuditActor {
  actorType: ActorType;
  actorLabel: string;
  meta?: Record<string, unknown>;
}

const storage = new AsyncLocalStorage<AuditActor>();

export function runWithAuditActor<T>(actor: AuditActor | null, fn: () => T): T {
  return actor ? storage.run(actor, fn) : fn();
}

export function getAuditActor(): AuditActor | undefined {
  return storage.getStore();
}
