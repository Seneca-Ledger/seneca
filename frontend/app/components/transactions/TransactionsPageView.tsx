'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Select } from '@/app/components/ui/select';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getCsrfHeaders } from '@/app/lib/csrf';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import DetailsDrawer from './DetailsDrawer';
import ExportModal from './ExportModal';
import SummaryBar from './SummaryBar';
import TransactionsTable from './TransactionsTable';
import type { Category, FilterState, StatementDetails, Transaction } from './types';

interface TransactionsPageViewProps {
  statement: StatementDetails;
  transactions: Transaction[];
  categories: Category[];
  onUpdateCategory?: (txIds: string[], categoryId: string) => Promise<void>;
  onDownload?: () => void;
  onReload?: () => Promise<void>;
}

interface BulkCategorizationResult {
  successful: number;
  failed: number;
  notFound: number;
  total: number;
  errors?: unknown;
}

async function requestBulkCategorization(
  transactionIds: string[],
): Promise<BulkCategorizationResult> {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || '/api/v1'}/classification/bulk`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCsrfHeaders(),
      },
      body: JSON.stringify({ transactionIds }),
    },
  );
  if (!response.ok) {
    throw new Error('Failed to auto-categorize transactions');
  }
  return (await response.json()) as BulkCategorizationResult;
}

/**
 * Main component for transaction view page with summary, table, and drawer
 */
export default function TransactionsPageView({
  statement,
  transactions,
  categories,
  onUpdateCategory,
  onDownload,
  onReload,
}: TransactionsPageViewProps) {
  const t = useIntlayer('transactionsPageView');
  const { locale } = useLocale();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailsTransaction, setDetailsTransaction] = useState<Transaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    category: null,
  });

  const handleRowClick = (transaction: Transaction) => {
    setDetailsTransaction(transaction);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setDetailsTransaction(null), 300);
  };

  const handleSingleUpdateCategory = async (txId: string, categoryId: string) => {
    if (!onUpdateCategory) {
      toast.error(t.notImplemented?.value || 'Not implemented yet');
      return;
    }

    // Messages resolved before the chain: React Compiler skips components with
    // optional chaining inside a try block.
    const successMessage = t.categoryUpdated?.value || 'Category updated successfully';
    const failureMessage = t.categoryUpdateFailed?.value || 'Failed to update category';
    await onUpdateCategory([txId], categoryId).then(
      () => {
        toast.success(successMessage);
        handleCloseDrawer();
      },
      (error: unknown) => {
        console.error('Failed to update category:', error);
        toast.error(failureMessage);
      },
    );
  };

  const handleSplitDone = async () => {
    handleCloseDrawer();
    if (onReload) await onReload();
  };

  const handleBulkAssignCategory = async () => {
    if (!bulkCategoryId || selectedIds.length === 0 || !onUpdateCategory) return;

    const successMessage =
      t.categoriesUpdated?.value || `Category assigned to ${selectedIds.length} transaction(s)`;
    const failureMessage = t.bulkUpdateFailed?.value || 'Failed to update categories';
    await onUpdateCategory(selectedIds, bulkCategoryId).then(
      () => {
        toast.success(successMessage);
        setSelectedIds([]);
        setBulkCategoryId('');
      },
      (error: unknown) => {
        console.error('Failed to bulk update categories:', error);
        toast.error(failureMessage);
      },
    );
  };

  const handleExport = () => {
    setExportModalOpen(true);
  };

  const handleFixIssues = async () => {
    const uncategorizedTxIds = transactions.filter(tx => !tx.category).map(tx => tx.id);

    if (uncategorizedTxIds.length === 0) {
      toast.success(t.allCategorized.value);
      return;
    }

    // No try/finally here (React Compiler skips components containing one);
    // the request itself lives in a module-level helper.
    setFixing(true);
    const toastId = toast.loading(
      t.categorizingProgress.value.replace('{{count}}', String(uncategorizedTxIds.length)),
    );
    await requestBulkCategorization(uncategorizedTxIds)
      .then(async results => {
        if (onReload) {
          await onReload();
        }
        reportCategorizationResults(results, toastId);
      })
      .catch((error: unknown) => {
        console.error('Failed to fix issues:', error);
        toast.error(t.autoFixFailed.value);
      });
    setFixing(false);
  };

  const reportCategorizationResults = (results: BulkCategorizationResult, toastId: string) => {
    if (results.successful > 0 && results.failed === 0 && results.notFound === 0) {
      toast.success(t.categorizeSuccess.value.replace('{{count}}', String(results.successful)), {
        id: toastId,
      });
    } else if (results.successful > 0 && (results.failed > 0 || results.notFound > 0)) {
      toast(
        t.categorizePartial.value
          .replace('{{successful}}', String(results.successful))
          .replace('{{total}}', String(results.total))
          .replace('{{failed}}', String(results.failed + results.notFound)),
        { id: toastId, duration: 6000, icon: '⚠️' },
      );
      console.error('Categorization errors:', results.errors);
    } else {
      toast.error(
        t.categorizeFailed.value.replace('{{count}}', String(results.failed + results.notFound)),
        { id: toastId },
      );
      console.error('All errors:', results.errors);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Summary Bar */}
      <SummaryBar
        statement={statement}
        transactions={transactions}
        onExport={handleExport}
        onFixIssues={handleFixIssues}
        onDownload={onDownload}
        fixing={fixing}
      />

      {/* Bulk Actions Toolbar */}
      {selectedIds.length > 0 && (
        <div className="seneca-tx-bulk">
          <div className="seneca-tx-bulk__count">
            <span className="seneca-tx-bulk__badge">{selectedIds.length}</span>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'var(--foreground)' }}>
              {t.selected.value}
            </Typography>
          </div>

          <div className="seneca-tx-bulk__controls">
            <Select
              value={bulkCategoryId}
              onChange={setBulkCategoryId}
              options={[
                { value: '', label: t.selectCategory.value },
                ...categories
                  .filter(cat => cat.isEnabled !== false)
                  .map(cat => ({ value: cat.id, label: getCategoryDisplayName(cat, locale) })),
              ]}
              sx={{ flex: 1, maxWidth: 320 }}
            />

            <button
              type="button"
              onClick={handleBulkAssignCategory}
              disabled={!bulkCategoryId}
              className="seneca-tx-bulk__apply-btn"
            >
              {t.apply.value}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="seneca-tx-bulk__clear-btn"
          >
            {t.clearSelection.value}
          </button>
        </div>
      )}

      {/* Transactions Table */}
      <TransactionsTable
        transactions={transactions}
        categories={categories}
        selectedIds={selectedIds}
        onSelectRows={setSelectedIds}
        onRowClick={handleRowClick}
        onUpdateCategory={handleSingleUpdateCategory}
        filters={filters}
        onFilterChange={setFilters}
      />

      {/* Details Drawer */}
      <DetailsDrawer
        open={drawerOpen}
        transaction={detailsTransaction}
        categories={categories}
        onClose={handleCloseDrawer}
        onUpdateCategory={handleSingleUpdateCategory}
        onSplitDone={onReload ? handleSplitDone : undefined}
      />

      {/* Export Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={type => {
          if (type === 'table') {
            toast.success(t.exportToTable.value);
          } else {
            toast.success(t.exportFormat.value.replace('{{type}}', type));
          }
        }}
      />
    </Box>
  );
}
