'use client';

import { useCallback, useEffect } from 'react';
import { useAutoSave } from '@/app/hooks/useAutoSave';
import type { Transaction } from '../editHelpers';
import {
  convertDroppedSampleAction,
  exportToCustomTable,
  loadStatementData,
  metadataAutoSave,
  updateStatementCategoryAction,
} from './statement-edit-async';
import {
  applyBulkCategoryAction,
  bulkDeleteAction,
  bulkUpdateAction,
  deleteTransactionAction,
  saveTransactionAction,
} from './statement-edit-sync';
import type { UseStatementEditFormReturn } from './useStatementEditFormTypes';
import { useStatementFormState } from './useStatementFormState';

export type { UseStatementEditFormReturn } from './useStatementEditFormTypes';

export interface UseStatementEditFormOptions {
  statementId: string;
  user: { id: string } | null | undefined;
  router: { push: (path: string) => void };
  messages: {
    loadDataError: string;
    saveTransactionError: string;
    deleteTransactionError: string;
    updateTransactionsError: string;
    deleteTransactionsError: string;
    assignCategoryError: string;
    exportLoading: string;
    exportSuccess: string;
    exportFailure: string;
    exportDescription: string;
    statementNamePrefix: string;
    categoryUpdated: string;
    categoryUpdateFailed: string;
  };
  /** Translated column titles for a table filled from this statement. */
  sourceColumnTitles: Record<string, string>;
}

// eslint-disable-next-line max-lines-per-function
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
        setBranches: s.setBranches,
        setWallets: s.setWallets,
        setMetadataForm: s.setMetadataForm,
        setError: s.setError,
      },
    );
  }, [
    statementId,
    messages.loadDataError,
    s.setLoading,
    s.setOptionsLoading,
    s.setStatement,
    s.setTransactions,
    s.setCategories,
    s.setBranches,
    s.setWallets,
    s.setMetadataForm,
    s.setError,
  ]);

  useEffect(() => {
    if (user && statementId) {
      void loadData();
    }
  }, [user, statementId, loadData]);

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

  const handleEdit = (transaction: Transaction): void => {
    s.setEditingRow(transaction.id);
    s.setEditedData({ [transaction.id]: { ...transaction } });
  };

  const handleFieldChange = (
    transactionId: string,
    field: keyof Transaction,
    value: Transaction[keyof Transaction],
  ): void => {
    s.setEditedData(prev => ({
      ...prev,
      [transactionId]: { ...prev[transactionId], [field]: value },
    }));
  };

  const handleSave = async (transactionId: string): Promise<void> => {
    await saveTransactionAction(transactionId, {
      original: s.transactions.find(t => t.id === transactionId),
      setTransactions: s.setTransactions,
      setEditingRow: s.setEditingRow,
      setSuccess: s.setSuccess,
      setError: s.setError,
      editedData: s.editedData,
      messages: { saveTransactionError: messages.saveTransactionError },
    });
  };

  const handleCancel = (): void => {
    s.setEditingRow(null);
    s.setEditedData({});
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
        setStatement: s.setStatement,
        setTransactions: s.setTransactions,
        setSuccess: s.setSuccess,
      });
    },
    [statementId, loadData, s.setStatement, s.setTransactions, s.setSuccess],
  );

  const handleDelete = async (transactionId: string): Promise<void> => {
    await deleteTransactionAction(transactionId, {
      setTransactions: s.setTransactions,
      setSuccess: s.setSuccess,
      setError: s.setError,
      messages: { deleteTransactionError: messages.deleteTransactionError },
    });
  };

  const handleBulkUpdate = async (): Promise<void> => {
    await bulkUpdateAction(loadData, {
      selectedRows: s.selectedRows,
      editedData: s.editedData,
      setSaving: s.setSaving,
      setSelectedRows: s.setSelectedRows,
      setEditedData: s.setEditedData,
      setSuccess: s.setSuccess,
      setError: s.setError,
      messages: { updateTransactionsError: messages.updateTransactionsError },
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

  const handleApplyBulkCategory = async (): Promise<void> => {
    await applyBulkCategoryAction(loadData, {
      bulkCategoryId: s.bulkCategoryId,
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

  const handleStatementCategorySelect = async (
    categoryId: string,
    flattenedStatementCategories: { id: string; name: string }[],
  ): Promise<void> => {
    await updateStatementCategoryAction({
      statement: s.statement,
      categoryId,
      flatCategories: flattenedStatementCategories,
      messages: {
        categoryUpdated: messages.categoryUpdated,
        categoryUpdateFailed: messages.categoryUpdateFailed,
      },
      statementCategorySaving: s.statementCategorySaving,
      setStatementCategorySaving: s.setStatementCategorySaving,
      setStatement: s.setStatement,
      setError: s.setError,
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
    editingRow: s.editingRow,
    editedData: s.editedData,
    categories: s.categories,
    branches: s.branches,
    wallets: s.wallets,
    bulkCategoryDialogOpen: s.bulkCategoryDialogOpen,
    setBulkCategoryDialogOpen: s.setBulkCategoryDialogOpen,
    statementCategoryDrawerOpen: s.statementCategoryDrawerOpen,
    setStatementCategoryDrawerOpen: s.setStatementCategoryDrawerOpen,
    statementCategorySaving: s.statementCategorySaving,
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
    handleEdit,
    handleFieldChange,
    handleSave,
    handleCancel,
    handleMetadataChange,
    handleResolveParsingWarning,
    handleConvertDroppedSample,
    handleDelete,
    handleBulkUpdate,
    handleBulkDelete,
    handleOpenBulkCategory,
    handleApplyBulkCategory,
    handleStatementCategorySelect,
  };
}
