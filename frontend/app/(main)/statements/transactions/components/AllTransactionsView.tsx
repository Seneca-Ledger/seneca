'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchBudgets } from '@/app/(main)/budgets/hooks/useBudgetsPage';
import { Plus } from '@/app/components/icons';
import DetailsDrawer from '@/app/components/transactions/DetailsDrawer';
import {
  fromStatementTransaction,
  mapApiRecordToTransaction,
} from '@/app/components/transactions/helpers/transactionMapper';
import { useBulkUpdateCategory } from '@/app/components/transactions/hooks/useBulkUpdateCategory';
import type { Transaction } from '@/app/components/transactions/types';
import { Button } from '@/app/components/ui/button';
import { LoadError } from '@/app/components/ui/load-error';
import { AppPagination } from '@/app/components/ui/pagination';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { formatMoney, resolveCurrencyCode } from '@/app/lib/format-money';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type { FilterSpan } from '../../components/filters/filter-summary';
import { useFilterSummary } from '../../components/filters/useFilterSummary';
import { TransactionsPageTitle } from '../../components/TransactionsPageTitle';
import {
  type FilterPaymentType,
  type ListedRow,
  monthBounds,
  type Period,
  paymentTypeFromParams,
  periodFromParams,
} from '../all-transactions';
import { PAGE_SIZE, useAllTransactions, useTransactionsOverview } from '../use-all-transactions';
import { AllTransactionsTable } from './AllTransactionsTable';
import { MonthsColumn } from './MonthsColumn';
import { OverviewPies } from './OverviewPies';
import { PaymentTypeFilter } from './PaymentTypeFilter';

function spanOf(period: Period): FilterSpan {
  if (period.kind === 'all') {
    return { kind: 'allTime' };
  }
  const { from, to } = monthBounds(period.month);
  return { kind: 'between', from: new Date(`${from}T00:00:00`), to: new Date(`${to}T00:00:00`) };
}

/**
 * Every booked row of the workspace in one place: what the period was spent
 * on, which accounts it left and where it went, the rows themselves with a
 * running wallet balance, and the months beside them.
 */
export function AllTransactionsView(): React.JSX.Element {
  const t = useIntlayer('allTransactionsPage');
  const tPage = useIntlayer('transactionsPageView');
  const { locale } = useLocale();
  const summarize = useFilterSummary();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = resolveCurrencyCode(currentWorkspace?.currency);
  const period = periodFromParams(searchParams);
  const paymentType = paymentTypeFromParams(searchParams);
  const periodKey = `${period.kind === 'all' ? 'all' : period.month}:${paymentType ?? ''}`;

  // The page and the ticked rows belong to one period and filter; a new one starts afresh.
  const [paging, setPaging] = useState({ periodKey, page: 1 });
  const page = paging.periodKey === periodKey ? paging.page : 1;
  const [selection, setSelection] = useState({ key: '', ids: new Set<string>() });
  const selectionKey = `${periodKey}:${page}`;
  const selected = selection.key === selectionKey ? selection.ids : new Set<string>();
  // The drawer reads its row from the list, so a saved change shows at once;
  // the copy taken on opening covers a row that has left the page.
  const [opened, setOpened] = useState<Transaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const list = useAllTransactions(period, page, paymentType);
  const overview = useTransactionsOverview(period);
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
  const formatAmount = (value: number) =>
    formatMoney(value, currency, locale, { fractionDigits: 0 });

  const goTo = (next: { month?: string; all?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('month');
    params.delete('all');
    if (next.all) {
      params.set('all', '1');
    } else if (next.month) {
      params.set('month', next.month);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setPaymentType = (next: FilterPaymentType | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set('paymentType', next);
    } else {
      params.delete('paymentType');
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setSelected = (ids: Set<string>) => setSelection({ key: selectionKey, ids });
  const toggle = (id: string) => {
    const ids = new Set(selected);
    if (!ids.delete(id)) {
      ids.add(id);
    }
    setSelected(ids);
  };

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

  const openRow = (row: ListedRow) => {
    setOpened(mapApiRecordToTransaction(fromStatementTransaction(row)));
    setDrawerOpen(true);
  };
  // The row stays in the drawer until its close animation is over.
  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setOpened(null), 300);
  };
  const liveRow = opened ? rows.find(row => row.id === opened.id) : undefined;
  const open = useMemo(
    () => (liveRow ? mapApiRecordToTransaction(fromStatementTransaction(liveRow)) : opened),
    [liveRow, opened],
  );
  const openSource = liveRow?.statementId;

  return (
    <div className="seneca-all-tx">
      <header className="seneca-all-tx__header">
        <TransactionsPageTitle page="all" span={spanOf(period)} extras={[]} />
      </header>

      <OverviewPies
        loading={overview.isPending}
        overview={overview.data}
        formatAmount={formatAmount}
      />
      <div
        className="seneca-all-tx__scope"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
      >
        {period.kind === 'all' ? (
          <button type="button" className="seneca-all-tx__text-link" onClick={() => goTo({})}>
            {t.showByMonth}
          </button>
        ) : (
          <button
            type="button"
            className="seneca-all-tx__text-link"
            onClick={() => goTo({ all: true })}
          >
            {t.showEverything}
          </button>
        )}
        <PaymentTypeFilter value={paymentType} onChange={setPaymentType} />
      </div>

      <div className="seneca-all-tx__body">
        <section className="seneca-all-tx__card seneca-all-tx__list">
          <div className="seneca-all-tx__list-head">
            <h2 className="seneca-all-tx__card-title">
              {summarize(
                { all: t.allTransactions.value, some: t.transactions.value },
                spanOf(period),
                [],
              )}
            </h2>
            <Button
              variant="outline"
              onClick={() => router.push('/statements/submit?openExpenseDrawer=manual')}
            >
              <Plus size={18} aria-hidden />
              {t.createTransaction}
            </Button>
          </div>
          {list.isError ? (
            <LoadError>{t.loadFailed}</LoadError>
          ) : !list.isPending && rows.length === 0 ? (
            <p className="seneca-all-tx__state seneca-all-tx__muted">{t.empty}</p>
          ) : (
            <AllTransactionsTable
              loading={list.isPending}
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
              onChange={next => setPaging({ periodKey, page: next })}
            />
          ) : null}
        </section>

        <MonthsColumn
          loading={overview.isPending}
          months={overview.data?.months ?? []}
          selected={period.kind === 'month' ? period.month : null}
          onSelect={month => goTo({ month })}
        />
      </div>

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
          openSource
            ? { href: `/statements/${openSource}/edit`, name: t.openDocument.value }
            : undefined
        }
        onChanged={closeDrawer}
      />
    </div>
  );
}
