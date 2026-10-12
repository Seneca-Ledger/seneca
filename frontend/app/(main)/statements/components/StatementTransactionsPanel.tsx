'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { CategoryIconBadge } from '@/app/components/dashboard/CategoryIconBadge';
import DetailsDrawer from '@/app/components/transactions/DetailsDrawer';
import {
  fromStatementTransaction,
  mapApiRecordToTransaction,
} from '@/app/components/transactions/helpers/transactionMapper';
import { useBulkUpdateCategory } from '@/app/components/transactions/hooks/useBulkUpdateCategory';
import type { Transaction } from '@/app/components/transactions/types';
import { Spinner } from '@/app/components/ui/spinner';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

const EMPTY_CELL = '—';

const formatAmount = (amount: number, currency: string | undefined): string =>
  `${new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)}${currency ?? ''}`;

/**
 * The rows of one statement, opened under its line in Documents. Loaded only
 * when opened; a row opens the same transaction drawer the statement page uses.
 */
export function StatementTransactionsPanel({
  statementId,
}: {
  statementId: string;
}): React.JSX.Element {
  const workspaceId = useWorkspaceId();
  const { locale } = useLocale();
  const tTable = useIntlayer('transactionsTable');
  const tPage = useIntlayer('transactionsPageView');
  const bulkUpdateCategory = useBulkUpdateCategory();
  const [open, setOpen] = useState<Transaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Under the ['transactions'] prefix, so a category change anywhere refreshes it.
  const rowsQuery = useQuery({
    queryKey: queryKeys.transactions({ workspaceId, params: { statementId } }),
    queryFn: async ({ signal }) => {
      const details = await apiQueryDecoded({
        url: `/storage/files/${statementId}`,
        signal,
        contract: 'StorageFileDetails',
      });
      return details.transactions.map(tx =>
        mapApiRecordToTransaction(fromStatementTransaction(tx)),
      );
    },
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    staleTime: 5 * 60_000,
  });
  const categories = categoriesQuery.data ?? [];
  const dateFormat = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });

  const openRow = (tx: Transaction): void => {
    setOpen(tx);
    setDrawerOpen(true);
  };
  // The row stays in the drawer until its close animation is over.
  const closeDrawer = (): void => {
    setDrawerOpen(false);
    setTimeout(() => setOpen(null), 300);
  };
  const updateCategory = async (txId: string, categoryId: string): Promise<void> => {
    const successMessage = tPage.categoryUpdated.value;
    const failureMessage = tPage.categoryUpdateFailed.value;
    await bulkUpdateCategory.mutateAsync({ txIds: [txId], categoryId }).then(
      () => {
        toast.success(successMessage);
        closeDrawer();
      },
      // The drawer stays open on failure so the choice can be retried.
      () => toast.error(failureMessage),
    );
  };

  const rows = rowsQuery.data ?? [];

  return (
    <div className="lumio-stmt-tx-panel">
      {rowsQuery.isPending ? (
        <div className="lumio-stmt-tx-panel__state">
          <Spinner style={{ width: 20, height: 20, color: 'var(--primary)' }} />
        </div>
      ) : rows.length === 0 ? (
        <div className="lumio-stmt-tx-panel__state">{tTable.noResults}</div>
      ) : (
        rows.map(tx => {
          const isIncome = tx.credit > 0 && !(tx.debit > 0);
          const icon = categories.find(cat => cat.id === tx.category?.id)?.icon;
          return (
            <button
              key={tx.id}
              type="button"
              className="lumio-stmt-tx-panel__row"
              onClick={() => openRow(tx)}
            >
              <span className="lumio-stmt-tx-panel__date">
                {dateFormat.format(new Date(`${tx.transactionDate.slice(0, 10)}T00:00:00`))}
              </span>
              <span className="lumio-stmt-tx-panel__name">
                {tx.isPrivate ? EMPTY_CELL : tx.counterpartyName || EMPTY_CELL}
              </span>
              <span className="lumio-stmt-tx-panel__category">
                {tx.category ? (
                  <>
                    <CategoryIconBadge
                      name={tx.category.name}
                      color={tx.category.color}
                      icon={icon}
                      size={18}
                    />
                    <span>{tx.category.name}</span>
                  </>
                ) : (
                  EMPTY_CELL
                )}
              </span>
              <span
                className={`lumio-stmt-tx-panel__amount${isIncome ? ' lumio-stmt-tx-panel__amount--income' : ''}`}
              >
                {isIncome ? '+' : ''}
                {formatAmount(tx.debit || tx.credit, tx.currency)}
              </span>
            </button>
          );
        })
      )}
      <DetailsDrawer
        open={drawerOpen}
        transaction={open}
        categories={categories}
        onClose={closeDrawer}
        onUpdateCategory={updateCategory}
        onSplitDone={async () => {
          closeDrawer();
          void rowsQuery.refetch();
        }}
      />
    </div>
  );
}
