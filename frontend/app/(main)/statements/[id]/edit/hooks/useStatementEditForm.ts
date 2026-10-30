'use client';

import { useCallback, useEffect } from 'react';
import { useAutoSave } from '@/app/hooks/useAutoSave';
import type { Transaction } from '../editHelpers';
import { applyCategoryToTarget, type SpreadMessages } from './category-target';
import {
  convertDroppedSampleAction,
  exportToCustomTable,
  loadStatementData,
  metadataAutoSave,
} from './statement-edit-async';
import {
  applyBulkCategoryAction,
  bulkDeleteAction,
  deleteTransactionAction,
} from './statement-edit-sync';
import { useResuggest } from './useResuggest';
import type { UseStatementEditFormReturn } from './useStatementEditFormTypes';
import { useStatementFormState } from './useStatementFormState';

export type { UseStatementEditFormReturn } from './useStatementEditFormTypes';

export interface UseStatementEditFormOptions {
  statementId: string;
  user: { id: string } | null | undefined;
  router: { push: (path: string) => void; replace: (path: string) => void };
  messages: {
    loadDataError: string;
    saveTransactionError: string;
    deleteTransactionError: string;
    deleteTransactionsError: string;
    assignCategoryError: string;
    exportLoading: string;
    exportSuccess: string;
    exportFailure: string;
    exportDescription: string;
    statementNamePrefix: string;
    spread: SpreadMessages;
  };
  /** Translated column titles for a table filled from this statement. */
  sourceColumnTitles: Record<string, string>;
}

export function useStatementEditForm({
  statementId,
  user,
  router,
  messages,
  sourceColumnTitles,
}: UseStatementEditFormOptions): UseStatementEditFormReturn {
  const s = useStatementFormState();
  // Destructured so effects/callbacks depend on the stable setters and refs,
  // not on the (re-created every render) state object.
  const { setStatement, setParsingDetailsExpanded } = s;
  const { balanceEndInputRef, balanceStartInputRef } = s;

  const loadData = useCallback(async (): Promise<void> => {
    await loadStatementData(
      statementId,
      { loadDataError: messages.loadDataError },
      {
        setLoading: s.setLoading,
        setOptionsLoading: s.setOptionsLoading,
        setStatement: s.setStatement,
        setTransactions: s.setTransactions,
        setCategories: s.setCategories,
        setMetadataForm: s.setMetadataForm,
        setError: s.setError,
        // Replace, not push: Back must not return to the editor it just left.
        redirect: router.replace,
      },
    );
  }, [
    router.replace,
    statementId,
    messages.loadDataError,
    s.setLoading,
    s.setOptionsLoading,
    s.setStatement,
    s.setTransactions,
    s.setCategories,
    s.setMetadataForm,
    s.setError,
  ]);

  useEffect(() => {
    if (user && statementId) {
      void loadData();
    }
  }, [user, statementId, loadData]);

  useResuggest(statementId, s.transactions, loadData);

  const handleMetadataAutoSave = useCallback(
    async (formData: Parameters<typeof metadataAutoSave>[0]['formData']): Promise<void> => {
      await metadataAutoSave({ statementId, formData, setStatement });
    },
    [statementId, setStatement],
  );

  useAutoSave({
    data: s.metadataForm,
    onSave: handleMetadataAutoSave,
    debounceMs: 500,
    enabled: Boolean(statementId && s.statement && !s.loading),
  });

  const handleExportToCustomTable = async (): Promise<void> => {
    await exportToCustomTable({
      columnTitles: sourceColumnTitles,
      statementId,
      statement: s.statement,
      router,
      messages,
      setExportingToTable: s.setExportingToTable,
    });
  };

  const handleRowSelect = (id: string): void => {
    const next = new Set(s.selectedRows);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    s.setSelectedRows(next);
  };

  const handleSelectAll = (): void => {
    if (s.selectedRows.size === s.transactions.length) {
      s.setSelectedRows(new Set());
    } else {
      s.setSelectedRows(new Set(s.transactions.map(t => t.id)));
    }
  };

  const handleMetadataChange = (field: string, value: string): void => {
    s.setMetadataForm(prev => ({ ...prev, [field]: value }));
  };

  const handleResolveParsingWarning = useCallback(
    (warning: string): void => {
      setParsingDetailsExpanded(true);
      const target = /balance mismatch/i.test(warning)
        ? balanceEndInputRef.current || balanceStartInputRef.current
        : null;
      if (target) {
        window.setTimeout(() => {
          if (typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          target.focus();
        }, 0);
      }
    },
    [setParsingDetailsExpanded, balanceEndInputRef, balanceStartInputRef],
  );

  const handleConvertDroppedSample = useCallback(
    async (sample: { transaction?: unknown }, index: number, warning?: string): Promise<void> => {
      await convertDroppedSampleAction({
        statementId,
        sample,
        index,
        warning,
        loadData,
        setSuccess: s.setSuccess,
      });
    },
    [statementId, loadData, s.setSuccess],
  );

  const handleDelete = async (transactionId: string): Promise<void> => {
    await deleteTransactionAction(transactionId, {
      setTransactions: s.setTransactions,
      setSuccess: s.setSuccess,
      setError: s.setError,
      messages: { deleteTransactionError: messages.deleteTransactionError },
    });
  };

  const handleBulkDelete = async (confirmMessage: string): Promise<void> => {
    await bulkDeleteAction(confirmMessage, loadData, {
      selectedRows: s.selectedRows,
      setTransactions: s.setTransactions,
      setSaving: s.setSaving,
      setSelectedRows: s.setSelectedRows,
      setSuccess: s.setSuccess,
      setError: s.setError,
      messages: { deleteTransactionsError: messages.deleteTransactionsError },
    });
  };

  const handleOpenBulkCategory = (): void => {
    if (s.selectedRows.size === 0) {
      return;
    }
    s.setBulkCategoryDialogOpen(true);
  };

  const handleOpenRowCategory = (transaction: Transaction): void => {
    s.setCategoryTarget({ ids: [transaction.id], spread: true });
    s.setBulkCategoryDialogOpen(true);
  };

  const handleOpenRowsCategory = (rows: Transaction[]): void => {
    s.setCategoryTarget({ ids: rows.map(row => row.id), spread: false });
    s.setBulkCategoryDialogOpen(true);
  };

  const handleCloseCategory = (): void => {
    s.setBulkCategoryDialogOpen(false);
    s.setCategoryTarget(null);
  };

  const handleApplyCategory = async (categoryId: string): Promise<void> => {
    const target = s.categoryTarget;
    if (target) {
      handleCloseCategory();
      await applyCategoryToTarget({
        target,
        categoryId,
        transactions: s.transactions,
        ctx: {
          categories: s.categories,
          setTransactions: s.setTransactions,
          setError: s.setError,
          messages: { saveTransactionError: messages.saveTransactionError },
        },
        messages: messages.spread,
      });
      return;
    }
    await applyBulkCategoryAction(loadData, {
      bulkCategoryId: categoryId,
      selectedRows: s.selectedRows,
      setSaving: s.setSaving,
      setSelectedRows: s.setSelectedRows,
      setBulkCategoryDialogOpen: s.setBulkCategoryDialogOpen,
      setBulkCategoryId: s.setBulkCategoryId,
      setSuccess: s.setSuccess,
      setError: s.setError,
      messages: { assignCategoryError: messages.assignCategoryError },
    });
  };

  return {
    statement: s.statement,
    setStatement: s.setStatement,
    transactions: s.transactions,
    setTransactions: s.setTransactions,
    loading: s.loading,
    saving: s.saving,
    exportingToTable: s.exportingToTable,
    optionsLoading: s.optionsLoading,
    error: s.error,
    setError: s.setError,
    success: s.success,
    setSuccess: s.setSuccess,
    selectedRows: s.selectedRows,
    setSelectedRows: s.setSelectedRows,
    categories: s.categories,
    bulkCategoryDialogOpen: s.bulkCategoryDialogOpen,
    setBulkCategoryDialogOpen: s.setBulkCategoryDialogOpen,
    categoryTarget: s.categoryTarget,
    bulkCategoryId: s.bulkCategoryId,
    setBulkCategoryId: s.setBulkCategoryId,
    metadataForm: s.metadataForm,
    setMetadataForm: s.setMetadataForm,
    exportConfirmOpen: s.exportConfirmOpen,
    setExportConfirmOpen: s.setExportConfirmOpen,
    parsingDetailsExpanded: s.parsingDetailsExpanded,
    setParsingDetailsExpanded: s.setParsingDetailsExpanded,
    balanceStartInputRef: s.balanceStartInputRef,
    balanceEndInputRef: s.balanceEndInputRef,
    loadData,
    handleExportToCustomTable,
    handleRowSelect,
    handleSelectAll,
    handleMetadataChange,
    handleResolveParsingWarning,
    handleConvertDroppedSample,
    handleDelete,
    handleBulkDelete,
    handleOpenBulkCategory,
    handleOpenRowCategory,
    handleOpenRowsCategory,
    handleCloseCategory,
    handleApplyCategory,
  };
}
