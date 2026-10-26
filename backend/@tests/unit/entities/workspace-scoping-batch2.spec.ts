import { AuditEvent } from '@/entities/audit-event.entity';
import { CategorizationRule } from '@/entities/categorization-rule.entity';
import { Category } from '@/entities/category.entity';
import { CustomTable } from '@/entities/custom-table.entity';
import { DataEntryCustomField } from '@/entities/data-entry-custom-field.entity';
import { DataEntry } from '@/entities/data-entry.entity';
import { Folder } from '@/entities/folder.entity';
import { IdempotencyKey } from '@/entities/idempotency-key.entity';
import { Insight } from '@/entities/insight.entity';
import { Integration } from '@/entities/integration.entity';
import { Notification } from '@/entities/notification.entity';
import { Payee } from '@/entities/payee.entity';
import { PayeeAlias } from '@/entities/payee-alias.entity';
import { Statement } from '@/entities/statement.entity';
import { StorageView } from '@/entities/storage-view.entity';
import { TaxRate } from '@/entities/tax-rate.entity';
import { Transaction } from '@/entities/transaction.entity';
import { Workspace } from '@/entities/workspace.entity';
import { getMetadataArgsStorage } from 'typeorm';

type RelationTypeResolver = string | (() => unknown);

const resolveRelationType = (type: RelationTypeResolver) =>
  typeof type === 'function' ? type() : type;

const resolveIndexColumns = (columns?: string[] | ((object?: object) => unknown)) =>
  Array.isArray(columns) ? columns.join(',') : '';

describe('Batch 2 workspace entity scoping', () => {
  const metadata = getMetadataArgsStorage();

  it('adds workspaceId and workspace relation to DataEntry', () => {
    const column = metadata.columns.find(
      entry => entry.target === DataEntry && entry.propertyName === 'workspaceId',
    );
    const relation = metadata.relations.find(
      entry => entry.target === DataEntry && entry.propertyName === 'workspace',
    );
    const typeDateIndex = metadata.indices.find(
      entry =>
        entry.target === DataEntry &&
        entry.name === 'IDX_data_entries_workspace_type_date' &&
        resolveIndexColumns(entry.columns) === 'workspaceId,type,date',
    );
    const customTabDateIndex = metadata.indices.find(
      entry =>
        entry.target === DataEntry &&
        entry.name === 'IDX_data_entries_workspace_custom_tab_date' &&
        resolveIndexColumns(entry.columns) === 'workspaceId,customTabId,date',
    );

    expect(column).toBeDefined();
    expect(column?.options.name).toBe('workspace_id');
    expect(column?.options.nullable).not.toBe(true);
    expect(relation).toBeDefined();
    expect(resolveRelationType(relation?.type as RelationTypeResolver)).toBe(Workspace);
    expect(typeDateIndex).toBeDefined();
    expect(customTabDateIndex).toBeDefined();
  });

  it('adds workspaceId and workspace relation to DataEntryCustomField', () => {
    const column = metadata.columns.find(
      entry => entry.target === DataEntryCustomField && entry.propertyName === 'workspaceId',
    );
    const relation = metadata.relations.find(
      entry => entry.target === DataEntryCustomField && entry.propertyName === 'workspace',
    );
    const uniqueIndex = metadata.indices.find(
      entry =>
        entry.target === DataEntryCustomField &&
        entry.name === 'IDX_data_entry_custom_fields_workspace_name_unique' &&
        resolveIndexColumns(entry.columns) === 'workspaceId,name' &&
        entry.unique === true,
    );

    expect(column).toBeDefined();
    expect(column?.options.name).toBe('workspace_id');
    expect(column?.options.nullable).not.toBe(true);
    expect(relation).toBeDefined();
    expect(resolveRelationType(relation?.type as RelationTypeResolver)).toBe(Workspace);
    expect(uniqueIndex).toBeDefined();
  });

  it('adds workspaceId and workspace relation to StorageView', () => {
    const column = metadata.columns.find(
      entry => entry.target === StorageView && entry.propertyName === 'workspaceId',
    );
    const relation = metadata.relations.find(
      entry => entry.target === StorageView && entry.propertyName === 'workspace',
    );

    expect(column).toBeDefined();
    expect(column?.options.name).toBe('workspace_id');
    expect(column?.options.nullable).not.toBe(true);
    expect(relation).toBeDefined();
    expect(resolveRelationType(relation?.type as RelationTypeResolver)).toBe(Workspace);
  });

  it.each([
    [Transaction, 'transaction'],
    [Statement, 'statement'],
    [Category, 'category'],
    [Notification, 'notification'],
    [Insight, 'insight'],
    [CustomTable, 'custom table'],
    [Folder, 'folder'],
    [TaxRate, 'tax rate'],
    [Integration, 'integration'],
    [CategorizationRule, 'categorization rule'],
    [Payee, 'payee'],
    [PayeeAlias, 'payee alias'],
    [IdempotencyKey, 'idempotency key'],
  ])('makes workspaceId non-nullable for %s', (entity, label) => {
    const column = metadata.columns.find(
      entry => entry.target === entity && entry.propertyName === 'workspaceId',
    );

    expect(column).toBeDefined();
    expect(column?.options.nullable).not.toBe(true);
  });

  // Исключение из правила выше: аудит обязан переживать удаление воркспейса,
  // поэтому его workspaceId nullable, а FK — ON DELETE SET NULL.
  it('keeps AuditEvent.workspaceId nullable so the audit trail survives workspace deletion', () => {
    const column = metadata.columns.find(
      entry => entry.target === AuditEvent && entry.propertyName === 'workspaceId',
    );

    expect(column).toBeDefined();
    expect(column?.options.nullable).toBe(true);
  });

  it('maps Payee columns to explicit snake_case names and workspace relation', () => {
    const column = (target: unknown, propertyName: string) =>
      metadata.columns.find(entry => entry.target === target && entry.propertyName === propertyName);
    const workspaceRelation = metadata.relations.find(
      entry => entry.target === Payee && entry.propertyName === 'workspace',
    );

    expect(column(Payee, 'workspaceId')?.options.name).toBe('workspace_id');
    expect(column(Payee, 'categoryId')?.options.name).toBe('category_id');
    expect(column(PayeeAlias, 'workspaceId')?.options.name).toBe('workspace_id');
    expect(column(PayeeAlias, 'payeeKey')?.options.name).toBe('payee_key');
    expect(column(PayeeAlias, 'payeeId')?.options.name).toBe('payee_id');
    expect(workspaceRelation).toBeDefined();
    expect(resolveRelationType(workspaceRelation?.type as RelationTypeResolver)).toBe(Workspace);
  });
});
