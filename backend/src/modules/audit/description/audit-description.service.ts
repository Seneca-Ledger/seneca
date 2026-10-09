import { Injectable } from '@nestjs/common';
import { AuditAction, type AuditEventDiff, EntityType } from '../../../entities/audit-event.entity';
import type { CreateAuditEventDto } from '../interfaces/audit-event.interface';

/**
 * A locale-independent description of an audit event.
 *
 * The service deliberately emits a template key plus raw parameters rather than
 * a finished sentence: the previous implementation composed Russian phrases out
 * of grammatical cases (nominative + genitive), which no dictionary swap can
 * turn into correct English. Clients render `key` in the viewer's locale;
 * `params` carry raw entity types and field keys, never display text.
 */
export type AuditDescriptor = {
  key: AuditDescriptionKey;
  params: Record<string, string | number>;
};

export type AuditDescriptionKey = keyof typeof DESCRIPTION_TEMPLATES_EN;

/**
 * English renderings, used to keep the `description` column populated and
 * readable. The localised copies live in the frontend dictionary.
 */
const DESCRIPTION_TEMPLATES_EN = {
  create: 'Created: {{entity}}',
  createNamed: 'Created: {{entity}} "{{name}}"',
  update: 'Changed: {{entity}}',
  updateOneField: 'Changed: {{field}}',
  updateManyFields: 'Changed {{entity}}: {{fields}}',
  updateManyFieldsMore: 'Changed {{entity}}: {{fields}} and {{more}} more',
  delete: 'Deleted: {{entity}}',
  deleteNamed: 'Deleted: {{entity}} "{{name}}"',
  rollback: 'Rolled back: {{entity}}',
  rollbackCreate: 'Rolled back: creation of {{entity}}',
  rollbackUpdate: 'Rolled back: change to {{entity}}',
  rollbackDelete: 'Rolled back: deletion of {{entity}}',
  import: 'Imported: {{entity}}',
  importSource: 'Imported from {{source}}',
  importSourceRows: 'Imported from {{source}}: {{rows}} records',
  link: 'Linked: {{entity}}',
  unlink: 'Unlinked: {{entity}}',
  match: 'Matched: {{entity}}',
  unmatch: 'Unmatched: {{entity}}',
  applyRule: 'Rule applied to {{entity}}',
  export: 'Exported: {{entity}}',
  fallback: '{{action}} {{entity}}',
} as const;

const ENTITY_LABELS_EN: Record<EntityType, string> = {
  [EntityType.TRANSACTION]: 'transaction',
  [EntityType.STATEMENT]: 'statement',
  [EntityType.RECEIPT]: 'receipt',
  [EntityType.PAYABLE]: 'payable',
  [EntityType.INVOICE]: 'invoice',
  [EntityType.CLIENT]: 'client',
  [EntityType.CATEGORY]: 'category',
  [EntityType.RULE]: 'rule',
  [EntityType.WORKSPACE]: 'workspace',
  [EntityType.INTEGRATION]: 'integration',
  [EntityType.TABLE_ROW]: 'table row',
  [EntityType.TABLE_CELL]: 'table cell',
  [EntityType.BRANCH]: 'branch',
  [EntityType.WALLET]: 'wallet',
  [EntityType.CUSTOM_TABLE]: 'table',
  [EntityType.CUSTOM_TABLE_COLUMN]: 'table column',
  [EntityType.BUDGET]: 'budget',
  [EntityType.SUBSCRIPTION]: 'subscription',
  [EntityType.LEDGER_ACCOUNT]: 'ledger account',
  [EntityType.JOURNAL_ENTRY]: 'journal entry',
  [EntityType.GOAL]: 'goal',
  [EntityType.CRYPTO_WALLET]: 'crypto wallet',
  [EntityType.TAX_RATE]: 'tax rate',
  [EntityType.TAX_RULE]: 'tax rule',
  [EntityType.TAX_RETURN]: 'tax return',
  [EntityType.WORKSPACE_MEMBER]: 'workspace member',
  [EntityType.API_KEY]: 'API key',
  [EntityType.WEBHOOK]: 'webhook',
  [EntityType.BACKUP]: 'backup',
  [EntityType.USER]: 'user account',
};

const FIELD_LABELS_EN: Partial<Record<EntityType, Record<string, string>>> = {
  [EntityType.WORKSPACE]: {
    name: 'workspace name',
    description: 'workspace description',
    icon: 'workspace icon',
    color: 'workspace colour',
    backgroundImage: 'workspace background image',
    currency: 'workspace currency',
    isFavorite: 'workspace favourite flag',
    settings: 'workspace settings',
  },
  [EntityType.CUSTOM_TABLE]: {
    name: 'table name',
    description: 'table description',
    source: 'table source',
    categoryId: 'table category',
    viewSettings: 'table view settings',
    dataEntryType: 'table data type',
    dataEntryScope: 'data entry scope',
  },
  [EntityType.CUSTOM_TABLE_COLUMN]: {
    title: 'column name',
    type: 'column type',
    isRequired: 'column required flag',
    isUnique: 'column unique flag',
    position: 'column order',
    config: 'column settings',
    key: 'column key',
  },
  [EntityType.CATEGORY]: {
    name: 'category name',
    color: 'category colour',
    icon: 'category icon',
    source: 'category source',
  },
  [EntityType.TRANSACTION]: {
    amount: 'transaction amount',
    description: 'transaction description',
    categoryId: 'transaction category',
    transactionDate: 'transaction date',
    status: 'transaction status',
  },
};

const TECHNICAL_FIELDS = new Set([
  'id',
  'createdAt',
  'updatedAt',
  'workspaceId',
  'userId',
  'ownerId',
  'deletedAt',
  'lastAccessedAt',
  'accessCount',
]);

const MAX_LISTED_FIELDS = 3;

/**
 * Did this field actually change, as a person would read it?
 *
 * A key missing from a snapshot and a key explicitly `null` both mean "nothing
 * here", and the two have to compare equal. They differ for mechanical reasons:
 * a column the entity never loads (`select: false`, like the ledger bookkeeping
 * fields) is `undefined` on the row and so vanishes when the snapshot is stored
 * as jsonb, while the saved copy carries it as `null`. Treating that as a change
 * made every edit report fields it never touched — "changed: paymentPurpose,
 * ledgerPostedAt, ledgerError" on a rename.
 */
function hasChanged(before: unknown, after: unknown): boolean {
  if (before === undefined || before === null) {
    return after !== undefined && after !== null;
  }
  if (after === undefined || after === null) {
    return true;
  }
  return JSON.stringify(before) !== JSON.stringify(after);
}

const interpolate = (template: string, params: Record<string, string | number>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));

/**
 * Renders a descriptor in English. Entity types and field keys in `params` are
 * mapped to readable labels here; clients do the same in their own locale.
 */
export function renderAuditDescriptionEnglish(descriptor: AuditDescriptor): string {
  const { key, params } = descriptor;
  const entityType = params.entity as EntityType | undefined;
  const readable: Record<string, string | number> = { ...params };

  if (entityType) {
    readable.entity = ENTITY_LABELS_EN[entityType] ?? entityType;
  }
  if (typeof params.field === 'string' && entityType) {
    readable.field = FIELD_LABELS_EN[entityType]?.[params.field] ?? params.field;
  }
  if (typeof params.fields === 'string' && entityType) {
    readable.fields = params.fields
      .split(',')
      .map(field => FIELD_LABELS_EN[entityType]?.[field] ?? field)
      .join(', ');
  }

  return interpolate(DESCRIPTION_TEMPLATES_EN[key], readable);
}

@Injectable()
export class AuditDescriptionService {
  generate(dto: CreateAuditEventDto): AuditDescriptor {
    const entity = dto.entityType;

    switch (dto.action) {
      case AuditAction.CREATE:
        return this.describeCreateOrDelete(dto, 'create', 'createNamed');
      case AuditAction.UPDATE:
        return this.describeUpdate(dto);
      case AuditAction.DELETE:
        return this.describeCreateOrDelete(dto, 'delete', 'deleteNamed');
      case AuditAction.ROLLBACK:
        return this.describeRollback(dto);
      case AuditAction.IMPORT:
        return this.describeImport(dto);
      case AuditAction.LINK:
        return { key: 'link', params: { entity } };
      case AuditAction.UNLINK:
        return { key: 'unlink', params: { entity } };
      case AuditAction.MATCH:
        return { key: 'match', params: { entity } };
      case AuditAction.UNMATCH:
        return { key: 'unmatch', params: { entity } };
      case AuditAction.APPLY_RULE:
        return { key: 'applyRule', params: { entity } };
      case AuditAction.EXPORT:
        return { key: 'export', params: { entity } };
      default:
        return { key: 'fallback', params: { entity, action: String(dto.action) } };
    }
  }

  private describeCreateOrDelete(
    dto: CreateAuditEventDto,
    bare: AuditDescriptionKey,
    named: AuditDescriptionKey,
  ): AuditDescriptor {
    const entity = dto.entityType;
    const name = this.getEntityName(dto.diff, dto.meta);

    return name ? { key: named, params: { entity, name } } : { key: bare, params: { entity } };
  }

  private describeUpdate(dto: CreateAuditEventDto): AuditDescriptor {
    const entity = dto.entityType;
    const fields = this.getChangedFieldKeys(dto.diff);

    if (fields.length === 1) {
      return { key: 'updateOneField', params: { entity, field: fields[0] } };
    }

    if (fields.length > MAX_LISTED_FIELDS) {
      return {
        key: 'updateManyFieldsMore',
        params: {
          entity,
          fields: fields.slice(0, MAX_LISTED_FIELDS).join(','),
          more: fields.length - MAX_LISTED_FIELDS,
        },
      };
    }

    if (fields.length > 1) {
      return { key: 'updateManyFields', params: { entity, fields: fields.join(',') } };
    }

    return { key: 'update', params: { entity } };
  }

  private describeRollback(dto: CreateAuditEventDto): AuditDescriptor {
    const entity = dto.entityType;
    const original = dto.meta?.originalAction;

    if (original === AuditAction.UPDATE) {
      return { key: 'rollbackUpdate', params: { entity } };
    }
    if (original === AuditAction.DELETE) {
      return { key: 'rollbackDelete', params: { entity } };
    }
    if (original === AuditAction.CREATE) {
      return { key: 'rollbackCreate', params: { entity } };
    }

    return { key: 'rollback', params: { entity } };
  }

  private describeImport(dto: CreateAuditEventDto): AuditDescriptor {
    const entity = dto.entityType;
    const source = dto.meta?.source || dto.meta?.provider;
    const rows = typeof dto.meta?.rowsCount === 'number' ? dto.meta.rowsCount : null;

    if (source && rows !== null) {
      return { key: 'importSourceRows', params: { entity, source: String(source), rows } };
    }
    if (source) {
      return { key: 'importSource', params: { entity, source: String(source) } };
    }

    return { key: 'import', params: { entity } };
  }

  /**
   * Raw field keys, not display labels — localisation happens at render time.
   */
  private getChangedFieldKeys(diff: AuditEventDiff | null | undefined): string[] {
    if (!diff || Array.isArray(diff)) {
      return [];
    }

    const before = diff.before ?? {};
    const after = diff.after ?? {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

    return keys
      .filter(key => !TECHNICAL_FIELDS.has(key))
      .filter(key =>
        hasChanged(
          (before as Record<string, unknown>)[key],
          (after as Record<string, unknown>)[key],
        ),
      );
  }

  private getEntityName(
    diff: AuditEventDiff | null | undefined,
    meta?: Record<string, unknown> | null,
  ): string | null {
    if (meta?.name && typeof meta.name === 'string') {
      return meta.name;
    }

    if (!diff || Array.isArray(diff)) {
      return null;
    }

    const candidate = diff.after ?? diff.before;
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    const record = candidate as Record<string, unknown>;
    for (const field of ['name', 'title', 'label'] as const) {
      const value = record[field];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }
}
