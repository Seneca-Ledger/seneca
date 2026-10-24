import apiClient from '@/app/lib/api';
import type {
  AuditEventPage,
  AuditRollbackResult,
  AuditEvent as ContractAuditEvent,
} from '@/app/lib/contracts';
import { checkContract } from '@/app/lib/query-fn-schema';

export type AuditJsonValue = string | number | boolean | null | AuditJsonObject | AuditJsonValue[];

export type AuditJsonObject = { [key: string]: AuditJsonValue };

export type ActorType = 'user' | 'system' | 'integration' | 'ai';
/** Mirrors the backend `EntityType` enum; the audit filter offers them in this order. */
export const ENTITY_TYPES = [
  'transaction',
  'statement',
  'receipt',
  'category',
  'rule',
  'payable',
  'invoice',
  'client',
  'budget',
  'goal',
  'subscription',
  'crypto_wallet',
  'tax_return',
  'tax_rate',
  'tax_rule',
  'ledger_account',
  'journal_entry',
  'custom_table',
  'custom_table_column',
  'table_row',
  'table_cell',
  'workspace',
  'workspace_member',
  'integration',
  'branch',
  'wallet',
  'api_key',
  'webhook',
  'backup',
  'user',
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

/** The audit log names entity types from a backend enum that grows: a newer one is shown by its key. */
export const isEntityType = (value: string): value is EntityType =>
  (ENTITY_TYPES as readonly string[]).includes(value);

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'import'
  | 'link'
  | 'unlink'
  | 'match'
  | 'unmatch'
  | 'apply_rule'
  | 'rollback'
  | 'export';

export type Severity = 'info' | 'warn' | 'critical';

export type BeforeAfterDiff = {
  before: AuditJsonObject | null;
  after: AuditJsonObject | null;
};

export type PatchOperation = {
  op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test';
  path: string;
  value?: AuditJsonValue;
  from?: string;
};

export type AuditEventDiff = BeforeAfterDiff | PatchOperation[];

export interface AuditEventMeta {
  /**
   * Locale-independent description emitted by the backend. Rendered in the
   * viewer's locale by formatAuditEvent; `description` holds the English text.
   */
  auditDescription?: { key: string; params: Record<string, string | number> };
  reason?: string;
  source?: string;
  confidence?: number;
  ruleId?: string;
  provider?: string;
  fileId?: string;
  rowsCount?: number;
  cell?: {
    row?: number;
    column?: string;
    a1?: string;
  };
  rollbackOf?: string;
  originalAction?: AuditAction;
  [key: string]: AuditJsonValue | undefined;
}

export type AuditEvent = ContractAuditEvent;

export interface AuditEventFilter {
  workspaceId?: string;
  entityType?: EntityType;
  entityId?: string;
  actorType?: ActorType;
  actorId?: string;
  action?: AuditAction;
  actorLabel?: string;
  dateFrom?: string;
  dateTo?: string;
  batchId?: string;
  severity?: Severity;
  page?: number;
  limit?: number;
}

type AuditEventResponse = AuditEventPage;

export type RollbackResponse = AuditRollbackResult;

export const fetchAuditEvents = async (filter: AuditEventFilter): Promise<AuditEventResponse> => {
  const response = await apiClient.get('/audit-events', { params: filter });
  // The page has a `data` key: checked raw, not through apiQueryDecoded's unwrap.
  return checkContract('AuditEventPage', response.data, '/audit-events');
};

export const rollbackEvent = async (eventId: string): Promise<RollbackResponse> => {
  const response = await apiClient.post(`/audit-events/${eventId}/rollback`);
  return checkContract('AuditRollbackResult', response.data, '/audit-events/:id/rollback');
};
