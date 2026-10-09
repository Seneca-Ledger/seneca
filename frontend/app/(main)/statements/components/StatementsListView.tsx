'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import toast from 'react-hot-toast';
import CreateExpenseDrawer from '@/app/(main)/statements/components/CreateExpenseDrawer';
import ConfirmModal from '@/app/components/ConfirmModal';
import { GitMerge, RefreshCcw } from '@/app/components/icons';
import { NoteCountsProvider } from '@/app/components/notes/NoteCountsContext';
import { PDFPreviewModal } from '@/app/components/PDFPreviewModal';
import { useKeyboardShortcuts } from '@/app/hooks/use-keyboard-shortcuts';
import { useLockBodyScroll } from '@/app/hooks/useLockBodyScroll';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorStatus } from '@/app/lib/api-error';
import type { DeviceLocation } from '@/app/lib/device-location';
import { resolveLabel } from '@/app/lib/side-panel-utils';
import type {
  CreateTaxRatePayload,
  ManualExpenseDraft,
  TaxRateOption,
} from '@/app/lib/statement-expense-drawer';
import type { MergeDuplicatesPlan } from './hooks/useStatementSelection';
import { useStatementsView } from './hooks/useStatementsView';
import {
  addPendingUploads,
  removePendingUploads,
  resolvePendingUploads,
} from './pending-uploads-store';
import { StatementsListHeader } from './StatementsListHeader';
import { StatementsListTable } from './StatementsListTable';
import { isGmailStatement, resolveStatementViewAction } from './StatementsListView.utils';
import { StatementsTableToolbar } from './StatementsTableToolbar';
import { uploadScanDrawerFiles as runUploadScanDrawerFiles } from './statement-upload';

// A created row normally replaces its placeholder within one refetch. The
// fallback covers a row the list never shows (hidden by search or a filter) or
// a failed refetch, and outlasts two 6s receipt polls.
const LISTED_UPLOAD_FALLBACK_MS = 20_000;

// ---- Manual expense form builder ----

interface ManualExpensePayload {
  draft: ManualExpenseDraft;
  date: string;
  files: File[];
  allowDuplicates: boolean;
}

function buildManualExpenseFormData(
  payload: ManualExpensePayload,
  resolvedTaxRateId: string,
): FormData {
  const formData = new FormData();
  formData.append('amount', payload.draft.amount.trim());
  formData.append('currency', payload.draft.currency.trim());
  formData.append('merchant', payload.draft.merchant.trim());
  formData.append('description', payload.draft.description.trim());
  formData.append('categoryId', payload.draft.categoryId);
  if (resolvedTaxRateId) formData.append('taxRateId', resolvedTaxRateId);
  formData.append('date', payload.date);
  formData.append('allowDuplicates', payload.allowDuplicates ? 'true' : 'false');
  payload.files.forEach(file => {
    formData.append('files', file);
  });
  return formData;
}

async function trySingleEndpoint(
  endpoint: string,
  formData: FormData,
): Promise<'ok' | 'skip' | 'fail'> {
  try {
    await apiClient.post(endpoint, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return 'ok';
  } catch (error: unknown) {
    const status = getApiErrorStatus(error);
    if (status === 404 || status === 405) return 'skip';
    console.error('Failed to create manual expense:', error);
    return 'fail';
  }
}

async function submitManualExpense(
  payload: ManualExpensePayload,
  taxRateId: string,
  onSuccess: () => Promise<void>,
  messages: { created: string; failed: string; unavailable: string },
): Promise<void> {
  const formData = buildManualExpenseFormData(payload, taxRateId);
  const endpoints = ['/statements/manual-expense', '/expenses/manual', '/expenses'];
  const results = await Promise.allSettled(endpoints.map(ep => trySingleEndpoint(ep, formData)));

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value === 'ok') {
      toast.success(messages.created);
      await onSuccess();
      return;
    }
    if (result.status === 'fulfilled' && result.value === 'fail') {
      throw new Error(messages.failed);
    }
  }
  throw new Error(messages.unavailable);
}

// ---- Pull indicator sub-component ----

interface PullIndicatorProps {
  isMobile: boolean;
  pullDistance: number;
  pullRefreshing: boolean;
  isReadyToRefresh: boolean;
}

function PullToRefreshIndicator({
  isMobile,
  pullDistance,
  pullRefreshing,
  isReadyToRefresh,
}: PullIndicatorProps): React.JSX.Element | null {
  const listText = useIntlayer('statementsListUi');
  if (!isMobile || (pullDistance <= 0 && !pullRefreshing)) return null;
  const badgeClass = `lumio-stmt-list-view__pull-badge${isReadyToRefresh || pullRefreshing ? ' lumio-stmt-list-view__pull-badge--ready' : ''}`;
  const label = pullRefreshing
    ? listText.refreshing
    : isReadyToRefresh
      ? listText.releaseToRefresh
      : listText.pullToRefresh;
  return (
    <div className="lumio-stmt-list-view__pull-indicator">
      <div className={badgeClass}>
        <RefreshCcw
          size={14}
          style={pullRefreshing ? { animation: 'spin 1s linear infinite' } : {}}
        />
        <span>{label}</span>
      </div>
    </div>
  );
}

function MergeDuplicatesSummary({
  plan,
}: {
  plan: MergeDuplicatesPlan | null;
}): React.JSX.Element | null {
  const listText = useIntlayer('statementsListUi');
  if (!plan) {
    return null;
  }
  const trashCount = plan.statementIds.length + plan.receiptIds.length;
  const lines: string[] = [];
  if (plan.gmailEntries.length > 0) {
    lines.push(
      listText.mergeGmailMarked.value.replace('{count}', String(plan.gmailEntries.length)),
    );
  }
  if (plan.receiptIds.length > 0) {
    lines.push(
      listText.mergeReceiptsTrash.value.replace('{count}', String(plan.receiptIds.length)),
    );
  }
  if (plan.statementIds.length > 0) {
    lines.push(
      listText.mergeStatementsTrash.value.replace('{count}', String(plan.statementIds.length)),
    );
  }
  if (plan.skippedGmailCount > 0) {
    lines.push(listText.mergeGmailSkipped.value.replace('{count}', String(plan.skippedGmailCount)));
  }

  return (
    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.625 }}>
      <p style={{ marginBottom: 12 }}>
        {listText.mergeSummary.value.replace('{count}', String(trashCount))}
      </p>
      <ul style={{ margin: 0, paddingInlineStart: 20 }}>
        {lines.map(line => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

// ---- Main component ----

export default function StatementsListView(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const v = useStatementsView({ router, searchParams, listScrollRef });
  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();
  const listText = useIntlayer('statementsListUi');

  useLockBodyScroll(v.expenseDrawerOpen);

  useKeyboardShortcuts({
    'Shift+KeyX': () => v.handleToggleSelectAll(true),
    'Shift+Delete': () => {
      void v.handleDeleteSelected();
    },
  });

  const { t, filterState, listHeaderLabels, paginationLabels, uploadLabels } = v;

  // Опции загрузчика растворились: search — часть ключа запроса, ошибку
  // рапортует сам хук данных. Остаётся только сбросить страницу и перезапросить.
  const refreshAfterCreate = async (): Promise<void> => {
    v.setPage(1);
    v.refetchStatements();
  };

  const refreshAfterAttach = (): void => {
    v.refetchStatements();
  };

  const onUploadSuccess = (msg: string): void => {
    toast.success(msg);
  };

  // Scan uploads come back as receipt rows, so the receipts list has to be
  // refetched too, not only statements.
  const refreshListsAfterScan = async (): Promise<void> => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['gmail-receipts', workspaceId] }),
      queryClient.invalidateQueries({ queryKey: ['statements', workspaceId] }),
    ]);
  };

  const uploadScanDrawerFiles = async (payload: {
    files: File[];
    allowDuplicates: boolean;
    requireManualCategorySelection: boolean;
    deviceLocationRequest: Promise<DeviceLocation | null> | null;
  }): Promise<void> => {
    v.setPage(1);
    const keys = addPendingUploads(workspaceId, payload.files.length);
    const resolvedKeys = new Set<string>();
    // A key without a statement id can never be matched to a row.
    const dropUnresolved = (): void => {
      removePendingUploads(keys.filter(key => !resolvedKeys.has(key)));
    };

    await runUploadScanDrawerFiles({
      payload,
      labels: uploadLabels,
      onUploadSuccess: onUploadSuccess,
      refreshAfterCreate: refreshListsAfterScan,
      onBatchCreated: (fileOffset, statementIds) => {
        const batchKeys = keys.slice(fileOffset, fileOffset + statementIds.length);
        resolvePendingUploads(batchKeys, statementIds);
        for (const key of batchKeys) {
          resolvedKeys.add(key);
        }
        window.setTimeout(() => removePendingUploads(batchKeys), LISTED_UPLOAD_FALLBACK_MS);
      },
    }).then(dropUnresolved, (error: unknown) => {
      dropUnresolved();
      // Earlier batches may have gone through before this one failed.
      if (resolvedKeys.size > 0) {
        void refreshListsAfterScan();
      }
      throw error;
    });
  };

  const handleCreateManualExpense = async (payload: ManualExpensePayload): Promise<void> => {
    const fallbackId = v.manualExpenseTaxRates.find(tr => tr.isEnabled && tr.isDefault)?.id ?? '';
    await submitManualExpense(payload, payload.draft.taxRateId ?? fallbackId, refreshAfterCreate, {
      created: listText.manualExpenseCreated.value,
      failed: listText.manualExpenseFailed.value,
      unavailable: listText.manualExpenseUnavailable.value,
    });
  };

  const handleCreateTaxRate = async (payload: CreateTaxRatePayload): Promise<TaxRateOption> => {
    const response = await apiClient.post('/tax-rates', payload);
    const created = response.data as TaxRateOption & { rate: number | string };
    await v.loadManualExpenseOptions();
    return {
      ...created,
      rate: Number(created.rate ?? payload.rate),
      isEnabled: created.isEnabled !== false,
    };
  };

  const handleView = (statement: Parameters<typeof resolveStatementViewAction>[0]): void => {
    router.push(resolveStatementViewAction(statement).href);
  };

  const handleIconClick = (statement: {
    id: string;
    source?: string;
    fileName: string;
    parsingDetails?: { importPreview?: { attachments?: number } };
  }): void => {
    const isReceipt = statement.source === 'gmail' || statement.source === 'scan';
    if (isReceipt) {
      v.openPreview({
        fileId: statement.id,
        fileName: statement.fileName || 'receipt.pdf',
        source: isGmailStatement(statement) ? 'gmail' : 'receipt',
        allowAttachFile: false,
      });
      return;
    }
    const isManual = statement.fileName.toLowerCase().startsWith('manual-expense-');
    const attachCount = Number(statement.parsingDetails?.importPreview?.attachments ?? 0);
    v.openPreview({
      fileId: statement.id,
      fileName: statement.fileName,
      source: 'statement',
      allowAttachFile: isManual && attachCount === 0,
    });
  };

  const reviewDuplicateLabel = resolveLabel(v.t.actions?.reviewDuplicate, 'Review');
  const markDuplicateLabel = resolveLabel(v.t.actions?.markDuplicate, 'Mark as duplicate');
  const markNotDuplicateLabel = resolveLabel(
    v.t.actions?.markNotDuplicate,
    'Mark as not duplicate',
  );
  const dismissDuplicateLabel = resolveLabel(
    v.t.actions?.dismissDuplicate,
    markNotDuplicateLabel || 'Dismiss',
  );
  const mergeDuplicatesLabel = resolveLabel(v.t.actions?.mergeDuplicates, 'Merge duplicates');
  const selectDuplicatesLabel = resolveLabel(v.t.actions?.selectDuplicates, 'Select duplicates');
  const viewLabel = resolveLabel(v.t.actions?.view, 'View');

  return (
    <div className="container-shared lumio-stmt-list-view" {...v.pullToRefreshHandlers}>
      <PullToRefreshIndicator
        isMobile={v.isMobile}
        pullDistance={v.pullDistance}
        pullRefreshing={v.pullRefreshing}
        isReadyToRefresh={v.isReadyToRefresh}
      />
      <StatementsListHeader
        selectedCount={v.selectedCount}
        selectedActionsOpen={v.selectedActionsOpen}
        hasSelectedDuplicates={v.hasSelectedDuplicates}
        draftFilters={filterState.draftFilters}
        activeFilterCount={v.activeFilterCount}
        dateDropdownOpen={filterState.dateDropdownOpen}
        filtersDrawerOpen={filterState.filtersDrawerOpen}
        filtersDrawerScreen={filterState.filtersDrawerScreen}
        columnsDrawerOpen={filterState.columnsDrawerOpen}
        columnsWithLabels={v.columnsWithLabels}
        visibleFilterScreens={v.visibleFilterScreens}
        routeFilterLabel={v.routeFilterLabel}
        onResetRouteFilter={v.resetRouteFilters}
        typeOptions={v.typeOptions}
        statusOptions={v.statusOptions}
        datePresets={v.datePresets}
        dateModes={v.dateModes}
        fromOptions={v.fromOptions}
        toOptions={v.fromOptions}
        groupByOptions={v.groupByOptions}
        hasOptions={v.hasOptions}
        currencyOptions={v.currencyOptions}
        filterLabels={v.filterLabels}
        filterOptionLabels={v.filterOptionLabels}
        mergeDuplicatesLabel={mergeDuplicatesLabel}
        dismissDuplicateLabel={dismissDuplicateLabel}
        markDuplicateLabel={markDuplicateLabel}
        onToggleActionsOpen={() => v.setSelectedActionsOpen(prev => !prev)}
        onMerge={v.handleMergeSelectedDuplicates}
        onDismiss={v.handleDismissSelectedDuplicates}
        onMarkDuplicate={v.handleMarkSelectedAsDuplicate}
        onExport={v.handleExportSelected}
        onDelete={v.handleDeleteSelected}
        onDateDropdownChange={filterState.setDateDropdownOpen}
        onFiltersDrawerClose={() => filterState.setFiltersDrawerOpen(false)}
        onFiltersDrawerOpen={() => {
          filterState.setDraftFilters(filterState.appliedFilters);
          filterState.setFiltersDrawerScreen('root');
          filterState.setFiltersDrawerOpen(true);
        }}
        onFiltersBack={() => filterState.setFiltersDrawerScreen('root')}
        onFiltersSelect={field => filterState.setFiltersDrawerScreen(field)}
        onUpdateFilters={filterState.updateFilter}
        onResetAllFilters={v.resetAllFilters}
        onViewResults={() => {
          filterState.applyFilterChanges();
          filterState.setFiltersDrawerOpen(false);
        }}
        onApplyDate={() => filterState.applyAndClose(() => filterState.setDateDropdownOpen(false))}
        onResetDate={() =>
          filterState.resetAndClose('date', () => filterState.setDateDropdownOpen(false))
        }
        onColumnsClose={() => filterState.setColumnsDrawerOpen(false)}
        onColumnsToggle={filterState.updateColumnsToggle}
        onColumnsReorder={filterState.handleReorderColumns}
        onColumnsSave={filterState.handleSaveColumns}
      />
      <div
        ref={listScrollRef}
        data-tour-id="statements-table"
        className="lumio-stmt-list-view__body"
        style={{ paddingBottom: v.selectedCount > 0 ? 96 : 0 }}
      >
        <NoteCountsProvider
          entityType="statement"
          entityIds={v.paginatedDisplayStatements.map(statement => statement.id)}
        >
          <StatementsListTable
            toolbar={
              <StatementsTableToolbar
                loading={v.isPending}
                draftFilters={filterState.draftFilters}
                fromOptions={v.fromOptions}
                fromDropdownOpen={filterState.fromDropdownOpen}
                duplicateStatementIds={v.duplicateStatementIds}
                labels={{
                  from: v.filterLabels.from,
                  columns: v.filterLabels.columns,
                  apply: v.filterOptionLabels.apply,
                  reset: v.filterOptionLabels.reset,
                  selectDuplicates: selectDuplicatesLabel,
                }}
                onFromDropdownChange={filterState.setFromDropdownOpen}
                onUpdateFilters={filterState.updateFilter}
                onApplyFrom={() =>
                  filterState.applyAndClose(() => filterState.setFromDropdownOpen(false))
                }
                onResetFrom={() =>
                  filterState.resetAndClose('from', () => filterState.setFromDropdownOpen(false))
                }
                onSelectDetectedDuplicates={v.handleSelectDetectedDuplicates}
                onColumnsOpen={filterState.handleColumnsOpen}
              />
            }
            loading={v.isPending}
            displayStatements={v.displayStatements}
            paginatedStatements={v.paginatedDisplayStatements}
            gmailSyncSkeletonKeys={v.listSkeletonKeys}
            allVisibleSelected={v.allVisibleSelected}
            selectedCount={v.selectedCount}
            selectedStatementIds={v.selectedStatementIds}
            dateSortDirection={v.dateSortDirection}
            page={v.page}
            totalPagesCount={v.totalPagesCount}
            rangeStart={v.rangeStart}
            rangeEnd={v.rangeEnd}
            total={v.total}
            duplicateMetaById={v.duplicateMetaById}
            statementReviewCounts={v.statementReviewCounts}
            columns={v.appliedColumnsWithLabels}
            currentExchangeRateLabels={v.currentExchangeRateLabels}
            workspaceCurrency={v.currentWorkspace?.currency}
            viewLabel={viewLabel}
            reviewDuplicateLabel={reviewDuplicateLabel}
            labels={{
              merchant: listHeaderLabels.merchant,
              date: listHeaderLabels.date,
              amount: listHeaderLabels.amount,
              action: listHeaderLabels.action,
              receipt: listHeaderLabels.receipt,
              scanning: listHeaderLabels.scanning,
              emptyTitle: resolveLabel(t.empty?.title, 'No statements yet'),
              emptyDescription: resolveLabel(
                t.empty?.description,
                'Upload your first statement to get started',
              ),
              paginationShown: paginationLabels.shown,
              paginationPageOf: paginationLabels.pageOf,
            }}
            onToggleSelectAll={v.handleToggleSelectAll}
            onToggleSortDirection={() =>
              v.setDateSortDirection(v.dateSortDirection === 'desc' ? 'asc' : 'desc')
            }
            onToggleStatement={v.handleToggleStatement}
            onView={handleView}
            onIconClick={handleIconClick}
            onPageChange={v.setPage}
          />
        </NoteCountsProvider>
      </div>
      {v.preview.fileId && (
        <PDFPreviewModal
          isOpen={v.preview.isOpen}
          onClose={v.closePreview}
          fileId={v.preview.fileId}
          fileName={v.preview.fileName}
          source={v.preview.source}
          allowAttachFile={v.preview.allowAttachFile}
          onFileAttached={refreshAfterAttach}
          onParsingStarted={refreshAfterAttach}
        />
      )}
      <CreateExpenseDrawer
        open={v.expenseDrawerOpen}
        initialMode={v.expenseDrawerMode}
        defaultCurrency={v.currentWorkspace?.currency ?? null}
        categories={v.manualExpenseCategories}
        taxRates={v.manualExpenseTaxRates}
        onClose={() => v.setExpenseDrawerOpen(false)}
        onSubmitScan={uploadScanDrawerFiles}
        onSubmitManual={handleCreateManualExpense}
        onCreateTaxRate={handleCreateTaxRate}
      />
      <ConfirmModal
        isOpen={v.mergePlan !== null}
        onClose={v.cancelMergeSelectedDuplicates}
        onConfirm={v.confirmMergeSelectedDuplicates}
        title={mergeDuplicatesLabel}
        message={<MergeDuplicatesSummary plan={v.mergePlan} />}
        confirmText={mergeDuplicatesLabel}
        isLoading={v.mergeRunning}
        manualClose
        icon={<GitMerge size={20} />}
      />
    </div>
  );
}
