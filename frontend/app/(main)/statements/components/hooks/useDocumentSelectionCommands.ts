'use client';

import { useQueryClient } from '@tanstack/react-query';
import React from 'react';
import toast from 'react-hot-toast';
import { buildSourceColumnTitles } from '@/app/(main)/custom-tables/labels';
import type { Command } from '@/app/components/command-palette/command-registry';
import {
  openPalettePicker,
  usePageCommands,
} from '@/app/components/command-palette/page-commands-store';
import {
  Copy,
  Download,
  GitMerge,
  ListChecks,
  Table,
  Table2,
  Tag,
  Trash2,
  X,
  XCircle,
} from '@/app/components/icons';
import { useKeyboardShortcuts } from '@/app/hooks/use-keyboard-shortcuts';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { invalidateDocumentLists } from '@/app/lib/invalidate-document-lists';
import { DOCUMENT_BINDINGS } from '@/app/lib/keyboard-shortcuts';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { useCategoryName } from '@/app/lib/use-category-name';
import { filterEnabledCategories } from '../../[id]/edit/editHelpers';
import { saveDocumentCategory } from '../DocumentCategoryDrawer';
import { acceptsDocuments, groupByCategory, tableStatementIds } from './document-selection';
import type { StatementsStatement } from './statementsViewTypes';

type Labels = Record<keyof typeof DOCUMENT_BINDINGS | 'dismissDuplicates', string>;

/** What the hook needs from the Documents view; a slice of `useStatementsView`. */
export interface DocumentSelectionView {
  paginatedDisplayStatements: StatementsStatement[];
  selectedStatementIds: string[];
  setSelectedStatementIds: (ids: string[]) => void;
  selectedCount: number;
  hasSelectedDuplicates: boolean;
  duplicateStatementIds: string[];
  handleToggleSelectAll: (checked: boolean) => void;
  handleExportSelected: () => Promise<void>;
  handleDeleteSelected: () => Promise<void>;
  handleMarkSelectedAsDuplicate: () => void;
  handleDismissSelectedDuplicates: () => void;
  handleSelectDetectedDuplicates: () => void;
  handleMergeSelectedDuplicates: () => void;
  setSelectedActionsOpen: (open: boolean) => void;
}

/** A dialog, a drawer or a menu keeps its keys; Escape there closes it, not the selection. */
function insideOverlay(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    event.defaultPrevented ||
    (target instanceof Element && !!target.closest('[role="dialog"], .MuiModal-root'))
  );
}

const icon = (Glyph: React.ComponentType<{ size?: number }>): React.ReactNode =>
  React.createElement(Glyph, { size: 18 });

type CategoryOption = ReturnType<typeof filterEnabledCategories>[number];

function flattenCategories(items: CategoryOption[]): CategoryOption[] {
  return items.flatMap(item => [item, ...flattenCategories(item.children ?? [])]);
}

/**
 * The Documents list's selection, from the keyboard and from the palette: pick
 * rows (all on the page, one category, the duplicates), then act on them (set a
 * category, build or grow a table, export, mark, merge, delete). One list of
 * commands drives both, so a key and its palette row can never disagree.
 * The "N selected" menu shows the same actions, which this hook hands back.
 */
export function useDocumentSelectionCommands(
  v: DocumentSelectionView,
  push: (href: string) => void,
): Command[] {
  const t = useIntlayer('documentSelectionCommands');
  const { labels: shortcutLabels } = useIntlayer('keyboardShortcutsModal');
  const listText = useIntlayer('statementsListUi');
  const { sidePanel } = useIntlayer('statementsPage');
  const tablesDictionary = useIntlayer('customTablesPage');
  const { locale } = useLocale();
  const categoryName = useCategoryName();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const labels: Labels = {
    selectAll: shortcutLabels.selectAll.value,
    clearSelection: shortcutLabels.clearSelection.value,
    selectByCategory: shortcutLabels.selectByCategory.value,
    selectDuplicates: shortcutLabels.selectDuplicates.value,
    setCategory: shortcutLabels.setCategory.value,
    createTable: shortcutLabels.createTable.value,
    addToTable: shortcutLabels.addToTable.value,
    export: shortcutLabels.export.value,
    markDuplicate: shortcutLabels.markDuplicate.value,
    mergeDuplicates: shortcutLabels.mergeDuplicates.value,
    dismissDuplicates: shortcutLabels.dismissDuplicates.value,
    deleteSelected: shortcutLabels.deleteSelected.value,
    selectionActions: shortcutLabels.selectionActions.value,
  };

  const selected = v.paginatedDisplayStatements.filter(row =>
    v.selectedStatementIds.includes(row.id),
  );
  const hasSelection = v.selectedCount > 0;

  const selectByCategory = (): void => {
    const buckets = groupByCategory(v.paginatedDisplayStatements);
    openPalettePicker({
      id: `select-category:${Date.now()}`,
      placeholder: t.pickCategory.value,
      items: buckets.map(bucket => ({
        id: bucket.id ?? '',
        label: bucket.name ? categoryName(bucket.name) : t.noCategory.value,
        icon: icon(Tag),
        hint: String(bucket.documentIds.length),
      })),
      onPick: id => {
        const bucket = buckets.find(item => (item.id ?? '') === id);
        if (bucket) {
          v.setSelectedStatementIds(bucket.documentIds);
        }
      },
    });
  };

  const applyCategory = async (category: CategoryOption): Promise<void> => {
    const results = await Promise.allSettled(
      selected.map(row => saveDocumentCategory(row, category.id, category.name)),
    );
    const failed = results.filter(result => result.status === 'rejected').length;
    const done = results.length - failed;
    invalidateDocumentLists();
    if (done === 0) {
      toast.error(t.categoryFailed.value);
      return;
    }
    const message = failed > 0 ? t.categoryPartial.value : t.categorySet.value;
    toast.success(message.replace('{count}', String(done)).replace('{failed}', String(failed)));
  };

  const setCategory = async (): Promise<void> => {
    const categories = await queryClient.fetchQuery({
      queryKey: queryKeys.categories(workspaceId),
      queryFn: ({ signal }) =>
        apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
      staleTime: 5 * 60_000,
    });
    const options = flattenCategories(filterEnabledCategories(categories));
    openPalettePicker({
      id: `set-category:${Date.now()}`,
      placeholder: t.pickCategory.value,
      items: options.map(category => ({
        id: category.id,
        label: categoryName(category.name),
        icon: icon(Tag),
      })),
      onPick: id => {
        const category = options.find(option => option.id === id);
        if (category) {
          void applyCategory(category);
        }
      },
    });
  };

  const createTable = async (): Promise<void> => {
    const statementIds = tableStatementIds(selected);
    if (statementIds.length === 0) {
      toast.error(t.noTransactions.value);
      return;
    }
    const toastId = toast.loading(t.tableCreating.value);
    try {
      const date = new Date().toLocaleDateString(locale);
      const response = await apiClient.post('/custom-tables/from-source', {
        kind: 'transactions',
        filters: { statementIds },
        name: `${sidePanel.documents.value} ${date}`,
        columnTitles: buildSourceColumnTitles(tablesDictionary),
      } satisfies ContractInput<'CreateCustomTableFromSourceBody'>);
      const { tableId } = await checkContract(
        'CreatedFromSource',
        response.data,
        '/custom-tables/from-source',
      );
      toast.dismiss(toastId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.customTables(workspaceId) });
      push(`/custom-tables/${tableId}`);
    } catch {
      toast.error(t.tableFailed.value, { id: toastId });
    }
  };

  const addToTable = async (tableId: string, tableName: string): Promise<void> => {
    const statementIds = tableStatementIds(selected);
    if (statementIds.length === 0) {
      toast.error(t.noTransactions.value);
      return;
    }
    const url = `/custom-tables/${tableId}/source-statements`;
    try {
      const response = await apiClient.post(url, {
        statementIds,
      } satisfies ContractInput<'AddSourceStatementsBody'>);
      const { inserted } = await checkContract('RefreshedFromSource', response.data, url);
      void queryClient.invalidateQueries({ queryKey: queryKeys.customTables(workspaceId) });
      toast.success(
        t.addedToTable.value.replace('{table}', tableName).replace('{count}', String(inserted)),
      );
    } catch {
      toast.error(t.addFailed.value);
    }
  };

  const pickTable = async (): Promise<void> => {
    const tables = await queryClient.fetchQuery({
      queryKey: queryKeys.customTables(workspaceId),
      queryFn: async ({ signal }) =>
        (await apiQueryDecoded({ url: '/custom-tables', signal, contract: 'CustomTableList' }))
          .items,
    });
    const targets = tables.filter(acceptsDocuments);
    openPalettePicker({
      id: `add-to-table:${Date.now()}`,
      placeholder: t.pickTable.value,
      items: targets.map(table => ({ id: table.id, label: table.name, icon: icon(Table2) })),
      onPick: id => {
        const table = targets.find(item => item.id === id);
        if (table) {
          void addToTable(table.id, table.name);
        }
      },
    });
  };

  const commands: Command[] = [
    {
      id: 'documents.selectAll',
      label: labels.selectAll,
      icon: icon(ListChecks),
      binding: DOCUMENT_BINDINGS.selectAll,
      run: () => v.handleToggleSelectAll(true),
    },
    {
      id: 'documents.selectByCategory',
      label: labels.selectByCategory,
      icon: icon(Tag),
      binding: DOCUMENT_BINDINGS.selectByCategory,
      run: selectByCategory,
    },
    ...(v.duplicateStatementIds.length > 0
      ? [
          {
            id: 'documents.selectDuplicates',
            label: labels.selectDuplicates,
            icon: icon(Copy),
            binding: DOCUMENT_BINDINGS.selectDuplicates,
            run: v.handleSelectDetectedDuplicates,
          },
        ]
      : []),
    ...(hasSelection
      ? [
          {
            id: 'documents.selectionActions',
            label: labels.selectionActions,
            icon: icon(ListChecks),
            binding: DOCUMENT_BINDINGS.selectionActions,
            run: () => v.setSelectedActionsOpen(true),
          },
          {
            id: 'documents.clearSelection',
            label: labels.clearSelection,
            icon: icon(X),
            binding: DOCUMENT_BINDINGS.clearSelection,
            run: () => v.setSelectedStatementIds([]),
          },
          {
            id: 'documents.setCategory',
            label: labels.setCategory,
            icon: icon(Tag),
            binding: DOCUMENT_BINDINGS.setCategory,
            run: () => void setCategory(),
          },
          {
            id: 'documents.createTable',
            label: labels.createTable,
            icon: icon(Table),
            binding: DOCUMENT_BINDINGS.createTable,
            run: () => void createTable(),
          },
          {
            id: 'documents.addToTable',
            label: labels.addToTable,
            icon: icon(Table2),
            binding: DOCUMENT_BINDINGS.addToTable,
            run: () => void pickTable(),
          },
          {
            id: 'documents.export',
            label: labels.export,
            icon: icon(Download),
            binding: DOCUMENT_BINDINGS.export,
            run: () => void v.handleExportSelected(),
          },
          {
            id: 'documents.markDuplicate',
            label: labels.markDuplicate,
            icon: icon(Copy),
            binding: DOCUMENT_BINDINGS.markDuplicate,
            run: v.handleMarkSelectedAsDuplicate,
          },
          ...(v.hasSelectedDuplicates
            ? [
                {
                  id: 'documents.mergeDuplicates',
                  label: labels.mergeDuplicates,
                  icon: icon(GitMerge),
                  binding: DOCUMENT_BINDINGS.mergeDuplicates,
                  run: v.handleMergeSelectedDuplicates,
                },
                {
                  id: 'documents.dismissDuplicates',
                  label: labels.dismissDuplicates,
                  icon: icon(XCircle),
                  run: v.handleDismissSelectedDuplicates,
                },
              ]
            : []),
          {
            id: 'documents.deleteSelected',
            label: labels.deleteSelected,
            icon: icon(Trash2),
            binding: DOCUMENT_BINDINGS.deleteSelected,
            run: () => void v.handleDeleteSelected(),
          },
        ]
      : []),
  ].map(command => ({ ...command, group: 'page' as const }));

  usePageCommands({
    title: hasSelection
      ? listText.selectedCount.value.replace('{count}', String(v.selectedCount))
      : sidePanel.documents.value,
    commands,
  });

  // Every binding is registered up front (the hook reads the key set once) and
  // finds its command at press time, so a key whose command is not on offer —
  // Escape with nothing selected — is left to the browser. Shift+E already
  // reaches the list through the global export event.
  const keyed = Object.values(DOCUMENT_BINDINGS).filter(
    binding => binding !== DOCUMENT_BINDINGS.export,
  );
  useKeyboardShortcuts(
    Object.fromEntries(
      keyed.map(binding => [
        binding,
        (event: KeyboardEvent) => {
          const command = commands.find(item => item.binding === binding);
          if (!command || insideOverlay(event)) {
            return;
          }
          // Ctrl+A would also select the page's text.
          event.preventDefault();
          command.run();
        },
      ]),
    ),
  );

  // Everything the selection can do, for the "N selected" menu: the actions in
  // palette order, then clearing the selection and, last, deleting it.
  const byId = (id: string): Command[] => commands.filter(command => command.id === id);
  const tail = ['documents.clearSelection', 'documents.deleteSelected'];
  const notAction = [
    'documents.selectAll',
    'documents.selectByCategory',
    'documents.selectDuplicates',
    'documents.selectionActions',
    ...tail,
  ];
  return hasSelection
    ? [...commands.filter(command => !notAction.includes(command.id)), ...tail.flatMap(byId)]
    : [];
}
