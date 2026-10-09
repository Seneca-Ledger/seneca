import type { useIntlayer } from '@/app/i18n';
import type { CreateTableDialogLabels } from './components/CreateTableDialog';
import type { SourceFilterPanelLabels } from './components/SourceFilterPanel';
import { SOURCE_KINDS, type SourceKind } from './sources';
import { TABLE_TEMPLATES, type TableTemplateId } from './templates';

type Dictionary = ReturnType<typeof useIntlayer<'customTablesPage'>>;

const record = <K extends string>(node: Record<K, { value: string }>, keys: readonly K[]) =>
  Object.fromEntries(keys.map(key => [key, node[key].value])) as Record<K, string>;

export interface ListLabels {
  header: { title: string; subtitle: string };
  actions: Record<
    | 'newTable'
    | 'open'
    | 'delete'
    | 'search'
    | 'sourceAll'
    | 'sourceManual'
    | 'caption'
    | 'rowActions',
    string
  >;
  columns: Record<'name' | 'source' | 'category' | 'rows' | 'updated', string>;
  empty: { title: string; description: string };
  toasts: Record<
    | 'loadTablesFailed'
    | 'created'
    | 'createFailed'
    | 'createdFromSource'
    | 'deleted'
    | 'deleteFailed',
    string
  >;
  create: CreateTableDialogLabels & {
    applying: string;
    partialFailed: string;
    columnTitles: Record<string, string>;
  };
  confirmDelete: Record<
    | 'title'
    | 'messageWithNamePrefix'
    | 'messageWithNameSuffix'
    | 'messageNoName'
    | 'confirm'
    | 'cancel',
    string
  >;
}

const templateLabels = (
  t: Dictionary,
): Record<TableTemplateId, { name: string; description: string }> =>
  Object.fromEntries(
    TABLE_TEMPLATES.map(template => [
      template.id,
      {
        name: t.create.templates[template.id].name.value,
        description: t.create.templates[template.id].description.value,
      },
    ]),
  ) as Record<TableTemplateId, { name: string; description: string }>;

const columnTitles = (t: Dictionary): Record<string, string> => {
  const node = t.create.templates.columns as Record<string, { value: string }>;
  return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, item.value]));
};

const plain = (node: Record<string, { value: string }>): Record<string, string> =>
  Object.fromEntries(Object.entries(node).map(([key, item]) => [key, item.value]));

const sourceLabels = (t: Dictionary): Record<SourceKind, { name: string; description: string }> =>
  Object.fromEntries(
    SOURCE_KINDS.map(source => [
      source.id,
      {
        name: t.createFromSource.sources[source.id].name.value,
        description: t.createFromSource.sources[source.id].description.value,
      },
    ]),
  ) as Record<SourceKind, { name: string; description: string }>;

const sourcePanelLabels = (t: Dictionary): SourceFilterPanelLabels => ({
  filters: record(t.createFromSource.filters, [
    'title',
    'dateFrom',
    'dateTo',
    'categories',
    'categoriesEmpty',
    'type',
    'currency',
    'currencyPlaceholder',
    'statements',
    'statementsEmpty',
    'status',
    'direction',
    'dueFrom',
    'dueTo',
    'any',
    'selected',
  ]),
  options: plain(t.createFromSource.options as Record<string, { value: string }>),
  preview: record(t.createFromSource.preview, [
    'title',
    'count',
    'loading',
    'empty',
    'overwriteNote',
    'failed',
  ]),
});

/**
 * Template and source fields share one title map: the same field means the
 * same word. Also used by the statement page when it fills a table from one statement.
 */
export const buildSourceColumnTitles = (t: Dictionary): Record<string, string> => ({
  ...columnTitles(t),
  ...plain(t.createFromSource.columns as Record<string, { value: string }>),
});

/** Plain strings for the components: they never see intlayer nodes. */
export function buildListLabels(t: Dictionary): ListLabels {
  const allColumnTitles = buildSourceColumnTitles(t);
  return {
    header: record(t.header, ['title', 'subtitle']),
    actions: record(t.actions, [
      'newTable',
      'open',
      'delete',
      'search',
      'sourceAll',
      'sourceManual',
      'caption',
      'rowActions',
    ]),
    columns: record(t.columns, ['name', 'source', 'category', 'rows', 'updated']),
    empty: record(t.empty, ['title', 'description']),
    toasts: {
      createdFromSource: t.createFromSource.toasts.createdFromSource.value,
      ...record(t.toasts, [
        'loadTablesFailed',
        'created',
        'createFailed',
        'deleted',
        'deleteFailed',
      ]),
    },
    create: {
      ...record(t.create, [
        'title',
        'name',
        'namePlaceholder',
        'description',
        'descriptionPlaceholder',
        'category',
        'noCategory',
        'creating',
      ]),
      submit: t.createExtra.submit.value,
      cancel: t.createExtra.cancel.value,
      templateLabel: t.createExtra.templateLabel.value,
      columnsCount: t.create.templates.columnsCount.value,
      applying: t.create.templates.applying.value,
      partialFailed: t.create.templates.partialFailed.value,
      blankName: t.create.templates.blank.name.value,
      blankDescription: t.create.templates.blank.description.value,
      templates: templateLabels(t),
      columnTitles: allColumnTitles,
      groupTemplates: t.createFromSource.groupTemplates.value,
      groupSources: t.createFromSource.groupSources.value,
      sources: sourceLabels(t),
      sourceColumnTitles: allColumnTitles,
      sourcePanel: sourcePanelLabels(t),
    },
    confirmDelete: record(t.confirmDelete, [
      'title',
      'messageWithNamePrefix',
      'messageWithNameSuffix',
      'messageNoName',
      'confirm',
      'cancel',
    ]),
  };
}
