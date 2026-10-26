'use client';

import Skeleton from '@mui/material/Skeleton';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchBudgets } from '@/app/(main)/budgets/hooks/useBudgetsPage';
import DetailsDrawer from '@/app/components/transactions/DetailsDrawer';
import {
  fromStatementTransaction,
  mapApiRecordToTransaction,
} from '@/app/components/transactions/helpers/transactionMapper';
import { useBulkUpdateCategory } from '@/app/components/transactions/hooks/useBulkUpdateCategory';
import type { Transaction } from '@/app/components/transactions/types';
import { AppPagination } from '@/app/components/ui/pagination';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQueryDecoded, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type { ListedRow } from '../../transactions/all-transactions';
import { AllTransactionsTable } from '../../transactions/components/AllTransactionsTable';

const PAGE_SIZE = 25;

/**
 * The payee's rows, as All transactions lists them: the same table, the same
 * drawer, the same bulk category change.
 */
export function PayeeTransactions({ payeeId }: { payeeId: string }): React.JSX.Element {
  const t = useIntlayer('payeesPage');
  const tPage = useIntlayer('transactionsPageView');
  const workspaceId = useWorkspaceId();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [opened, setOpened] = useState<Transaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const params = { payeeId, page, limit: PAGE_SIZE, running_balance: 1 };
  const list = useQuery({
    queryKey: queryKeys.transactions({ workspaceId, params: { view: 'payee', ...params } }),
    // A `{ data, total }` page: checked raw, since apiQueryDecoded would unwrap `data`.
    queryFn: async ({ signal }) => {
      const response = await apiClient.get('/transactions', { params, signal });
      return checkContract('TransactionListPage', response.data, '/transactions');
    },
    placeholderData: keepPreviousData,
    enabled: Boolean(workspaceId),
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    staleTime: 5 * 60_000,
    enabled: Boolean(workspaceId),
  });
  const budgetsQuery = useQuery({
    queryKey: queryKeys.budgets(workspaceId),
    queryFn: ({ signal }) => fetchBudgets(signal),
    enabled: Boolean(workspaceId),
  });
  const bulkUpdateCategory = useBulkUpdateCategory();

  const budgetByCategory = useMemo(
    () => new Map((budgetsQuery.data ?? []).map(budget => [budget.categoryId, budget.name])),
    [budgetsQuery.data],
  );
  const rows = list.data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / PAGE_SIZE));

  const setCategory = async (ids: string[], categoryId: string): Promise<boolean> => {
    try {
      await bulkUpdateCategory.mutateAsync({ txIds: ids, categoryId });
      toast.success(tPage.categoryUpdated.value);
      return true;
    } catch {
      toast.error(tPage.categoryUpdateFailed.value);
      return false;
    }
  };
  const toggle = (id: string) => {
    const ids = new Set(selected);
    if (!ids.delete(id)) {
      ids.add(id);
    }
    setSelected(ids);
  };
  const openRow = (row: ListedRow) => {
    setOpened(mapApiRecordToTransaction(fromStatementTransaction(row)));
    setDrawerOpen(true);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setOpened(null), 300);
  };
  const liveRow = opened ? rows.find(row => row.id === opened.id) : undefined;
  const open = useMemo(
    () => (liveRow ? mapApiRecordToTransaction(fromStatementTransaction(liveRow)) : opened),
    [liveRow, opened],
  );

  return (
    <section className="seneca-all-tx__card seneca-all-tx__list">
      <div className="seneca-all-tx__list-head">
        <h2 className="seneca-all-tx__card-title">{t.transactionsTitle}</h2>
      </div>
      {list.isPending ? (
        <div className="seneca-all-tx__state">
          {Array.from({ length: 4 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={index} variant="rounded" height={36} />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="seneca-all-tx__state seneca-all-tx__muted">{t.noTransactions}</p>
      ) : (
        <AllTransactionsTable
          rows={rows}
          categories={categoriesQuery.data ?? []}
          budgetByCategory={budgetByCategory}
          selected={selected}
          onToggle={toggle}
          onToggleAll={checked => setSelected(new Set(checked ? rows.map(row => row.id) : []))}
          onSetCategory={(ids, categoryId) => {
            void setCategory(ids, categoryId).then(done => done && setSelected(new Set()));
          }}
          onOpen={openRow}
        />
      )}
      {totalPages > 1 ? (
        <AppPagination
          className="seneca-all-tx__pagination"
          page={page}
          total={totalPages}
          onChange={next => {
            setPage(next);
            setSelected(new Set());
          }}
        />
      ) : null}

      <DetailsDrawer
        open={drawerOpen}
        transaction={open}
        categories={categoriesQuery.data ?? []}
        onClose={closeDrawer}
        onUpdateCategory={async (txId, categoryId) => {
          await setCategory([txId], categoryId);
        }}
        onSplitDone={closeDrawer}
        source={
          liveRow?.statementId
            ? { href: `/statements/${liveRow.statementId}/edit`, name: t.openDocument.value }
            : undefined
        }
        onChanged={closeDrawer}
      />
    </section>
  );
}
