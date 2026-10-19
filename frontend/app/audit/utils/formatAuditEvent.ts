import { getIntlayer } from 'react-intlayer';
import { DEFAULT_LOCALE, readLocaleFromCookie } from '@/app/lib/locale';
import {
  type AuditAction,
  type AuditEvent,
  type EntityType,
  isEntityType,
  type Severity,
} from '@/lib/api/audit';

type ActionTone = 'info' | 'warn' | 'critical' | 'primary' | 'success';

const ACTION_LABELS: Record<AuditAction, string> = {
  create: 'Create',
  update: 'Change',
  delete: 'Delete',
  import: 'Import',
  link: 'Link',
  unlink: 'Unlink',
  match: 'Match',
  unmatch: 'Unmatch',
  apply_rule: 'Apply Rule',
  rollback: 'Rollback',
  export: 'Export',
};

const ENTITY_LABELS: Record<EntityType, string> = {
  transaction: 'Transaction',
  statement: 'Statement',
  receipt: 'Receipt',
  category: 'Category',
  rule: 'Rule',
  workspace: 'Workspace',
  integration: 'Integration',
  table_row: 'Table Row',
  table_cell: 'Table Cell',
  branch: 'Branch',
  wallet: 'Wallet',
  custom_table: 'Custom Table',
  custom_table_column: 'Custom Table Column',
  payable: 'Payable',
  budget: 'Budget',
  subscription: 'Subscription',
  invoice: 'Invoice',
  client: 'Client',
  ledger_account: 'Ledger account',
  journal_entry: 'Journal entry',
  goal: 'Goal',
  crypto_wallet: 'Crypto wallet',
  tax_rate: 'Tax rate',
  tax_rule: 'Tax rule',
  tax_return: 'Tax return',
  workspace_member: 'Workspace member',
  api_key: 'API key',
  webhook: 'Webhook',
  backup: 'Backup',
  user: 'User account',
};

const ACTION_VERBS: Record<AuditAction, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  import: 'imported',
  link: 'linked',
  unlink: 'unlinked',
  match: 'merged',
  unmatch: 'unmatched',
  apply_rule: 'categorized',
  rollback: 'rolled back',
  export: 'exported',
};

const ACTION_TONES: Record<AuditAction, ActionTone> = {
  create: 'success',
  update: 'primary',
  delete: 'critical',
  import: 'primary',
  link: 'info',
  unlink: 'warn',
  match: 'info',
  unmatch: 'warn',
  apply_rule: 'success',
  rollback: 'warn',
  export: 'info',
};

const SEVERITY_TONES: Record<Severity, ActionTone> = {
  info: 'info',
  warn: 'warn',
  critical: 'critical',
};

const FormatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildFallbackDescription = (
  actionLabel: string,
  objectLabel: string,
  entityId?: string | null,
): string => {
  const baseLabel = `${actionLabel} ${objectLabel}`;
  const trimmedId = typeof entityId === 'string' ? entityId.trim() : '';
  if (!trimmedId) return baseLabel;
  return `${baseLabel} ${trimmedId}`;
};

type DictionaryNode = { value?: unknown } | string | undefined;

type AuditDictionary = {
  templates?: Record<string, DictionaryNode>;
  entities?: Record<string, DictionaryNode>;
  actions?: Record<string, DictionaryNode>;
  verbs?: Record<string, DictionaryNode>;
  diff?: Record<string, DictionaryNode>;
};

/**
 * getIntlayer answers a missing dictionary with a path-stringifying Proxy, so
 * only a genuine string counts — otherwise we fall back to the English
 * sentence the backend stored.
 */
const readValue = (node: DictionaryNode): string | undefined => {
  if (typeof node === 'string') {
    return node;
  }
  const value = node?.value;
  return typeof value === 'string' ? value : undefined;
};

/**
 * Field keys arrive raw (`backgroundImage`) so the backend stays locale-free.
 * ponytail: humanised inline rather than carried in a 30-key dictionary —
 * add one if translated field names turn out to matter.
 */
const humanizeFieldKey = (key: string): string =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase();

const interpolate = (template: string, params: Record<string, string | number>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));

const readDictionary = (): AuditDictionary => {
  try {
    return getIntlayer(
      'auditDescriptions',
      readLocaleFromCookie() ?? DEFAULT_LOCALE,
    ) as AuditDictionary;
  } catch {
    return {};
  }
};

const formatDiffKeys = (keys: string[], dictionary: AuditDictionary): string => {
  const diff = dictionary.diff;
  if (keys.length === 1) {
    return interpolate(readValue(diff?.field) ?? 'Field: {{field}}', { field: keys[0] });
  }
  const displayedKeys = keys.slice(0, 3);
  const remainingCount = keys.length - displayedKeys.length;
  const fields = displayedKeys.join(', ');
  return remainingCount
    ? interpolate(readValue(diff?.fieldsMore) ?? 'Fields: {{fields}} +{{count}} more', {
        fields,
        count: remainingCount,
      })
    : interpolate(readValue(diff?.fields) ?? 'Fields: {{fields}}', { fields });
};

/**
 * Renders the backend's locale-independent descriptor in the viewer's locale.
 * Returns undefined when the dictionary does not know the key, so the caller
 * can fall back to the English sentence the backend already stored.
 */
const renderDescriptor = (
  descriptor: {
    key: string;
    params: Record<string, string | number>;
  },
  dictionary: AuditDictionary,
): string | undefined => {
  try {
    const template = readValue(dictionary.templates?.[descriptor.key]);
    if (!template) {
      return undefined;
    }

    const params: Record<string, string | number> = { ...descriptor.params };
    const entity = descriptor.params.entity;
    if (typeof entity === 'string') {
      params.entity = readValue(dictionary.entities?.[entity]) ?? entity;
    }
    if (typeof descriptor.params.field === 'string') {
      params.field = humanizeFieldKey(descriptor.params.field);
    }
    if (typeof descriptor.params.fields === 'string') {
      params.fields = descriptor.params.fields.split(',').map(humanizeFieldKey).join(', ');
    }

    return interpolate(template, params);
  } catch {
    return undefined;
  }
};

const extractDescription = (
  event: AuditEvent,
  actionLabel: string,
  objectLabel: string,
  dictionary: AuditDictionary,
): string => {
  const descriptor = event.meta?.auditDescription;
  if (descriptor?.key) {
    const localized = renderDescriptor(descriptor, dictionary);
    if (localized) {
      return localized;
    }
  }

  if (event.description?.trim()) {
    return event.description.trim();
  }

  const diff = event.diff;
  if (!diff || Array.isArray(diff)) {
    return buildFallbackDescription(actionLabel, objectLabel, event.entityId);
  }

  const before = diff.before ?? {};
  const after = diff.after ?? {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort();

  if (keys.length === 0) {
    return buildFallbackDescription(actionLabel, objectLabel, event.entityId);
  }

  return formatDiffKeys(keys, dictionary);
};

export const formatAuditEvent = (
  event: AuditEvent,
): {
  actionLabel: string;
  actionVerb: string;
  objectLabel: string;
  description: string;
  severity: string;
  actionTone: ActionTone;
} => {
  const dictionary = readDictionary();
  const actionLabel =
    readValue(dictionary.actions?.[event.action]) ?? ACTION_LABELS[event.action] ?? event.action;
  const actionVerb =
    readValue(dictionary.verbs?.[event.action]) ?? ACTION_VERBS[event.action] ?? event.action;
  const entityName = readValue(dictionary.entities?.[event.entityType]);
  const objectLabel = entityName
    ? entityName.charAt(0).toLocaleUpperCase() + entityName.slice(1)
    : isEntityType(event.entityType)
      ? ENTITY_LABELS[event.entityType]
      : event.entityType;
  const description = extractDescription(event, actionLabel, objectLabel, dictionary);
  const actionTone =
    event.severity === 'warn' || event.severity === 'critical'
      ? SEVERITY_TONES[event.severity]
      : (ACTION_TONES[event.action] ?? 'info');

  return {
    actionLabel,
    actionVerb,
    objectLabel,
    description,
    severity: event.severity,
    actionTone,
  };
};
