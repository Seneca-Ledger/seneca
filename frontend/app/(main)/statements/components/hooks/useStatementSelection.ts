/* eslint-disable max-lines */

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient, { gmailReceiptsApi } from '@/app/lib/api';
import { getApiErrorStatus } from '@/app/lib/api-error';
import {
  areAllVisibleSelected,
  toggleSelectAllVisible,
  toggleStatementSelection,
} from '@/app/lib/statement-selection';
import {
  DUPLICATE_GROUP_TONES,
  type DuplicateGroupTone,
  getDeleteEndpoint,
  getExportEndpoint,
  isGmailStatement,
  isScanReceiptStatement,
  type StatementLike,
} from '../StatementsListView.utils';

// ---------------------------------------------------------------------------
// Shared types (re-exported for use in StatementsListView)
// ---------------------------------------------------------------------------

export type DuplicateRole = 'primary' | 'suspected';

export type DuplicateMeta = {
  position: number;
  total: number;
  role: DuplicateRole;
  reason: string;
  groupKey: string;
  groupLabel: string;
  groupTone: DuplicateGroupTone;
  primaryId: string;
};

export type DuplicateOverrideState = 'duplicate' | 'not_duplicate';

export type DuplicateOverride = {
  state: DuplicateOverrideState;
  groupKey?: string;
  groupLabel?: string;
  groupTone?: DuplicateGroupTone;
  primaryId?: string;
  position?: number;
  total?: number;
};

// ---------------------------------------------------------------------------
// Merge helpers (extracted to reduce cognitive complexity)
// ---------------------------------------------------------------------------

type ClassifyResult = {
  statementsToDelete: Set<string>;
  receiptsToDelete: Set<string>;
  gmailToMark: Map<string, string>;
  skippedGmailCount: number;
};

function classifyDuplicatesForMerge(
  statements: StatementLike[],
  allStatements: StatementLike[],
  duplicateMetaById: Map<string, DuplicateMeta>,
): ClassifyResult {
  const statementById = new Map(allStatements.map(s => [s.id, s]));
  const statementsToDelete = new Set<string>();
  const receiptsToDelete = new Set<string>();
  const gmailToMark = new Map<string, string>();
  let skippedGmailCount = 0;

  for (const statement of statements) {
    const meta = duplicateMetaById.get(statement.id);
    if (!meta || statement.id === meta.primaryId) {
      continue;
    }

    if (isGmailStatement(statement)) {
      const primary = statementById.get(meta.primaryId);
      if (primary && isGmailStatement(primary)) {
        gmailToMark.set(statement.id, primary.id);
      } else {
        skippedGmailCount += 1;
      }
      continue;
    }

    if (isScanReceiptStatement(statement)) {
      receiptsToDelete.add(statement.id);
      continue;
    }

    statementsToDelete.add(statement.id);
  }

  return { statementsToDelete, receiptsToDelete, gmailToMark, skippedGmailCount };
}

function tabulateDeleteResults(
  results: PromiseSettledResult<unknown>[],
  ids: string[],
): { succeeded: string[]; failed: number } {
  const succeeded: string[] = [];
  let failed = 0;
  results.forEach((result, index) => {
    const id = ids[index];
    if (!id) {
      return;
    }
    if (result.status === 'fulfilled') {
      succeeded.push(id);
      return;
    }
    const status = getApiErrorStatus(result.reason);
    if (status === 404 || status === 410) {
      succeeded.push(id);
      return;
    }
    failed += 1;
  });
  return { succeeded, failed };
}

function tabulateMarkResults(
  results: PromiseSettledResult<unknown>[],
  entries: [string, string][],
): { succeeded: string[]; failed: number } {
  const succeeded: string[] = [];
  let failed = 0;
  results.forEach((result, index) => {
    const receiptId = entries[index]?.[0];
    if (!receiptId) {
      return;
    }
    if (result.status === 'fulfilled') {
      succeeded.push(receiptId);
      return;
    }
    failed += 1;
  });
  return { succeeded, failed };
}

/** Pending merge, awaiting user confirmation in the merge-duplicates modal. */
export type MergeDuplicatesPlan = {
  /** Bank statements to move to trash. */
  statementIds: string[];
  /** Scanned receipts to move to trash. */
  receiptIds: string[];
  /** Gmail receipts to mark as duplicate, as `[duplicateId, primaryId]`. */
  gmailEntries: [string, string][];
  skippedGmailCount: number;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseStatementSelectionParams {
  /** All statements currently matching applied filters (pre-pagination). */
  displayStatements: StatementLike[];
  /** IDs of statements on the current page. */
  visibleStatementIds: string[];
  /** Duplicate detection result, derived by the parent from `duplicateOverrides`. */
  duplicateMetaById: Map<string, DuplicateMeta>;
  setDuplicateOverrides: React.Dispatch<React.SetStateAction<Record<string, DuplicateOverride>>>;
  search: string;
  onRefreshStatements: (opts?: {
    silent?: boolean;
    showErrorToast?: boolean;
    search?: string;
  }) => Promise<void>;
  onRefreshGmail: (opts?: { silent?: boolean; showErrorToast?: boolean }) => Promise<void>;
}

export interface UseStatementSelectionResult {
  selectedStatementIds: string[];
  setSelectedStatementIds: React.Dispatch<React.SetStateAction<string[]>>;
  selectedActionsOpen: boolean;
  setSelectedActionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedActionsRef: React.RefObject<HTMLDivElement | null>;
  allVisibleSelected: boolean;
  selectedCount: number;
  selectedDuplicateCount: number;
  hasSelectedDuplicates: boolean;
  duplicateStatementIds: string[];
  handleToggleStatement: (statementId: string) => void;
  handleToggleSelectAll: (checked: boolean) => void;
  handleExportSelected: () => Promise<void>;
  handleDeleteSelected: () => Promise<void>;
  handleMarkSelectedAsDuplicate: () => void;
  handleDismissSelectedDuplicates: () => void;
  handleSelectDetectedDuplicates: () => void;
  handleMergeSelectedDuplicates: () => void;
  mergePlan: MergeDuplicatesPlan | null;
  mergeRunning: boolean;
  confirmMergeSelectedDuplicates: () => Promise<void>;
  cancelMergeSelectedDuplicates: () => void;
}

// eslint-disable-next-line max-lines-per-function
export function useStatementSelection({
  displayStatements,
  visibleStatementIds,
  duplicateMetaById,
  setDuplicateOverrides,
  search,
  onRefreshStatements,
  onRefreshGmail,
}: UseStatementSelectionParams): UseStatementSelectionResult {
  const selectionText = useIntlayer('statementsSelection');
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>([]);
  const [selectedActionsOpen, setSelectedActionsOpen] = useState(false);
  const [mergePlan, setMergePlan] = useState<MergeDuplicatesPlan | null>(null);
  const [mergeRunning, setMergeRunning] = useState(false);
  const selectedActionsRef = useRef<HTMLDivElement | null>(null);

  const selectedCount = selectedStatementIds.length;
  const allVisibleSelected = areAllVisibleSelected(selectedStatementIds, visibleStatementIds);
  const duplicateStatementIds = visibleStatementIds.filter(id => duplicateMetaById.has(id));
  const selectedDuplicateCount = selectedStatementIds.filter(id =>
    duplicateMetaById.has(id),
  ).length;
  const hasSelectedDuplicates = selectedDuplicateCount > 0;

  // Deselect statements that scroll off-page / get filtered out. Returning `prev`
  // when nothing left the page keeps state unchanged, so a new-but-equal ids
  // array from the parent cannot turn this effect into a render loop.
  useEffect(() => {
    const visibleSet = new Set(visibleStatementIds);
    setSelectedStatementIds(prev =>
      prev.every(id => visibleSet.has(id)) ? prev : prev.filter(id => visibleSet.has(id)),
    );
  }, [visibleStatementIds]);

  // Close bulk-action menu when selection empties
  useEffect(() => {
    if (selectedCount === 0) {
      setSelectedActionsOpen(false);
    }
  }, [selectedCount]);

  // Close bulk-action menu on outside click
  useEffect(() => {
    if (!selectedActionsOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent): void => {
      if (!selectedActionsRef.current) {
        return;
      }
      if (!selectedActionsRef.current.contains(event.target as Node)) {
        setSelectedActionsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [selectedActionsOpen]);

  const handleToggleStatement = (statementId: string): void => {
    setSelectedStatementIds(prev => toggleStatementSelection(prev, statementId));
  };

  const handleToggleSelectAll = (checked: boolean): void => {
    setSelectedStatementIds(prev => toggleSelectAllVisible(prev, visibleStatementIds, checked));
  };

  const triggerDownload = async (statement: StatementLike): Promise<boolean> => {
    return await (async () => {
      const response = await apiClient.get(getExportEndpoint(statement), {
        responseType: 'blob',
      });
      const blob = response.data as Blob;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = (statement as { fileName?: string }).fileName ?? `${statement.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    })().catch(async error => {
      console.error(`Failed to export statement ${statement.id}:`, error);
      return false;
    });
  };

  const handleExportSelected = async (): Promise<void> => {
    if (selectedStatementIds.length === 0) {
      return;
    }

    return await (async () => {
      const exportableStatements = displayStatements.filter(statement =>
        selectedStatementIds.includes(statement.id),
      );

      if (exportableStatements.length === 0) {
        return;
      }

      const results = await Promise.all(
        exportableStatements.map(statement => triggerDownload(statement)),
      );
      const exportedCount = results.filter(Boolean).length;
      const failedCount = results.length - exportedCount;

      if (exportedCount === 0) {
        toast.error(selectionText.exportFailed.value);
        return;
      }

      toast.success(
        (failedCount > 0 ? selectionText.exportedPartial.value : selectionText.exported.value)
          .replace('{count}', String(exportedCount))
          .replace('{failed}', String(failedCount)),
      );
      setSelectedActionsOpen(false);
    })().catch(async error => {
      console.error('Failed to export selected statements:', error);
      toast.error(selectionText.exportFailed.value);
    });
  };

  const handleDeleteSelected = async () => {
    if (selectedStatementIds.length === 0) {
      return;
    }

    const deletableStatements = displayStatements.filter(statement =>
      selectedStatementIds.includes(statement.id),
    );

    if (deletableStatements.length === 0) {
      return;
    }

    const confirmed = window.confirm(
      selectionText.confirmDelete.value.replace('{count}', String(deletableStatements.length)),
    );
    if (!confirmed) {
      return;
    }

    return await (async () => {
      const results = await Promise.allSettled(
        deletableStatements.map(statement => apiClient.delete(getDeleteEndpoint(statement))),
      );
      const deletedIds: string[] = [];
      const failedIds: string[] = [];

      results.forEach((result, index) => {
        const statementId = deletableStatements[index]?.id;
        if (!statementId) {
          return;
        }
        if (result.status === 'fulfilled') {
          deletedIds.push(statementId);
          return;
        }
        const status = getApiErrorStatus(result.reason);
        if (status === 404 || status === 410) {
          deletedIds.push(statementId);
          return;
        }
        failedIds.push(statementId);
      });

      if (deletedIds.length === 0) {
        toast.error(selectionText.deleteFailed.value);
        return;
      }

      setSelectedStatementIds(prev => prev.filter(id => !deletedIds.includes(id)));
      setSelectedActionsOpen(false);
      await onRefreshStatements({ search, showErrorToast: false });

      toast.success(
        failedIds.length > 0
          ? selectionText.deletedPartial.value
              .replace('{count}', String(deletedIds.length))
              .replace('{failed}', String(failedIds.length))
          : selectionText.deleted.value,
      );
    })().catch(async error => {
      console.error('Failed to delete selected statements:', error);
      toast.error(selectionText.deleteFailed.value);
    });
  };

  const handleMarkSelectedAsDuplicate = () => {
    if (selectedStatementIds.length === 0) {
      return;
    }

    setDuplicateOverrides(prev => {
      const next = { ...prev };
      const manualGroupIndex = Object.values(prev).filter(override =>
        override.groupKey?.startsWith('manual-group:'),
      ).length;
      const groupKey = `manual-group:${Date.now()}:${manualGroupIndex}`;
      const groupLabel = selectionText.groupManualNumbered.value.replace(
        '{n}',
        String(manualGroupIndex + 1),
      );
      const groupTone = DUPLICATE_GROUP_TONES[manualGroupIndex % DUPLICATE_GROUP_TONES.length];
      const primaryId = selectedStatementIds[0];
      const total = selectedStatementIds.length;

      selectedStatementIds.forEach((statementId, index) => {
        next[statementId] = {
          state: 'duplicate',
          groupKey,
          groupLabel,
          groupTone,
          primaryId,
          position: index + 1,
          total,
        };
      });
      return next;
    });

    toast.success(
      selectionText.markedDuplicate.value.replace('{count}', String(selectedStatementIds.length)),
    );
    setSelectedActionsOpen(false);
  };

  const handleDismissSelectedDuplicates = () => {
    if (selectedStatementIds.length === 0) {
      return;
    }

    setDuplicateOverrides(prev => {
      const next = { ...prev };
      selectedStatementIds.forEach(statementId => {
        next[statementId] = { state: 'not_duplicate' };
      });
      return next;
    });

    toast.success(
      selectionText.dismissedDuplicates.value.replace(
        '{count}',
        String(selectedStatementIds.length),
      ),
    );
    setSelectedActionsOpen(false);
  };

  const handleSelectDetectedDuplicates = () => {
    if (duplicateStatementIds.length === 0) {
      toast.error(selectionText.noDuplicates.value);
      return;
    }

    setSelectedStatementIds(prev => Array.from(new Set([...prev, ...duplicateStatementIds])));
    toast.success(
      selectionText.selectedDuplicates.value.replace(
        '{count}',
        String(duplicateStatementIds.length),
      ),
    );
  };

  const handleMergeSelectedDuplicates = (): void => {
    if (selectedStatementIds.length < 2) {
      toast.error(selectionText.mergeMinItems.value);
      return;
    }

    const selectedStatements = displayStatements.filter(statement =>
      selectedStatementIds.includes(statement.id),
    );
    const selectedDuplicateStatements = selectedStatements.filter(statement =>
      duplicateMetaById.has(statement.id),
    );

    if (selectedDuplicateStatements.length < 2) {
      toast.error(selectionText.mergeMinDuplicates.value);
      return;
    }

    const { statementsToDelete, receiptsToDelete, gmailToMark, skippedGmailCount } =
      classifyDuplicatesForMerge(selectedDuplicateStatements, displayStatements, duplicateMetaById);

    if (statementsToDelete.size === 0 && receiptsToDelete.size === 0 && gmailToMark.size === 0) {
      toast.error(selectionText.noMergeable.value);
      return;
    }

    setSelectedActionsOpen(false);
    setMergePlan({
      statementIds: Array.from(statementsToDelete),
      receiptIds: Array.from(receiptsToDelete),
      gmailEntries: Array.from(gmailToMark.entries()),
      skippedGmailCount,
    });
  };

  const cancelMergeSelectedDuplicates = (): void => {
    if (mergeRunning) {
      return;
    }
    setMergePlan(null);
  };

  const runMerge = async (plan: MergeDuplicatesPlan): Promise<void> => {
    const deletions: { id: string; endpoint: string }[] = [
      ...plan.statementIds.map(id => ({ id, endpoint: `/statements/${id}` })),
      ...plan.receiptIds.map(id => ({ id, endpoint: `/receipts/${id}` })),
    ];

    const [deleteResults, gmailMarkResults] = await Promise.all([
      Promise.allSettled(deletions.map(item => apiClient.delete(item.endpoint))),
      Promise.allSettled(
        plan.gmailEntries.map(([receiptId, originalId]) =>
          gmailReceiptsApi.markDuplicate(receiptId, originalId),
        ),
      ),
    ]);

    const deleteOutcome = tabulateDeleteResults(
      deleteResults,
      deletions.map(item => item.id),
    );
    const markOutcome = tabulateMarkResults(gmailMarkResults, plan.gmailEntries);
    const deletedIds = deleteOutcome.succeeded;
    const markedGmailIds = markOutcome.succeeded;

    if (deletedIds.length === 0 && markedGmailIds.length === 0) {
      toast.error(selectionText.mergeFailed.value);
      return;
    }

    setDuplicateOverrides(prev => {
      const next = { ...prev };
      markedGmailIds.forEach(receiptId => {
        next[receiptId] = { state: 'duplicate' };
      });
      return next;
    });

    const processedIds = new Set([...deletedIds, ...markedGmailIds]);
    setSelectedStatementIds(prev => prev.filter(id => !processedIds.has(id)));

    await onRefreshStatements({ silent: true, search, showErrorToast: false });
    await onRefreshGmail({ silent: true, showErrorToast: false });

    const skipHint = plan.skippedGmailCount
      ? ` ${selectionText.mergeSkipHint.value.replace('{count}', String(plan.skippedGmailCount))}`
      : '';
    const failureHint =
      deleteOutcome.failed || markOutcome.failed
        ? ` ${selectionText.mergeFailureHint.value
            .replace('{receipts}', String(markOutcome.failed))
            .replace('{items}', String(deleteOutcome.failed))}`
        : '';
    const mergedMessage = selectionText.merged.value
      .replace('{receipts}', String(markedGmailIds.length))
      .replace('{items}', String(deletedIds.length));
    toast.success(`${mergedMessage}${skipHint}${failureHint}`);
  };

  const confirmMergeSelectedDuplicates = async (): Promise<void> => {
    if (!mergePlan || mergeRunning) {
      return;
    }
    setMergeRunning(true);
    try {
      await runMerge(mergePlan);
    } catch (error) {
      console.error('Failed to merge selected duplicates:', error);
      toast.error(selectionText.mergeFailed.value);
    } finally {
      setMergeRunning(false);
      setMergePlan(null);
    }
  };

  return {
    selectedStatementIds,
    setSelectedStatementIds,
    selectedActionsOpen,
    setSelectedActionsOpen,
    selectedActionsRef,
    allVisibleSelected,
    selectedCount,
    selectedDuplicateCount,
    hasSelectedDuplicates,
    duplicateStatementIds,
    handleToggleStatement,
    handleToggleSelectAll,
    handleExportSelected,
    handleDeleteSelected,
    handleMarkSelectedAsDuplicate,
    handleDismissSelectedDuplicates,
    handleSelectDetectedDuplicates,
    handleMergeSelectedDuplicates,
    mergePlan,
    mergeRunning,
    confirmMergeSelectedDuplicates,
    cancelMergeSelectedDuplicates,
  };
}
