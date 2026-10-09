/* eslint-disable max-lines */
'use client';

import Skeleton from '@mui/material/Skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/app/components/ui/button';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useAttentionFocus } from '@/app/hooks/useAttentionFocus';
import { useAuth } from '@/app/hooks/useAuth';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { FALLBACK_CURRENCY } from '@/app/lib/currency';
import {
  type CreatePayableInput,
  type ListPayablesParams,
  type Payable,
  type PayableDirection,
  type PayablesSummary,
  payablesApi,
  type UpdatePayableInput,
} from '@/app/lib/payables-api';
import { queryKeys } from '@/app/lib/query-keys';
import { getNestedValue, resolveLabel } from '@/app/lib/side-panel-utils';
import { tokens } from '@/lib/theme-tokens';
import { StatementsQueueTabs } from '../StatementsQueueTabs';
import { CreatePayableDrawer } from './CreatePayableDrawer';
import { MarkPaidDialog, type MarkPaidResult } from './MarkPaidDialog';
import PayableFiltersBar from './PayableFiltersBar';
import PayableSummaryCards from './PayableSummaryCards';
import PayablesList from './PayablesList';
import {
  buildPayablesListParams,
  DEFAULT_PAYABLES_FILTERS,
  type PayablesFiltersState,
} from './payables-utils';

const DEFAULT_SUMMARY: PayablesSummary = {
  toPay: 0,
  overdue: 0,
  dueThisWeek: 0,
  paidThisMonth: 0,
  paidTotal: 0,
  toPayCount: 0,
  overdueCount: 0,
  paidTotalCount: 0,
};

const PAGE_SIZE = 20;

const SUMMARY_CARD_KEYS = ['card-0', 'card-1', 'card-2', 'card-3'];
const PAYABLE_ROW_KEYS = ['row-0', 'row-1', 'row-2', 'row-3', 'row-4', 'row-5', 'row-6'];

function PayablesSummaryCardSkeleton(): React.JSX.Element {
  return (
    <div
      style={{
        border: '1px solid var(--border-color)',
        borderRadius: tokens.radius.lg,
        padding: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Skeleton variant="text" width="50%" height={16} />
        <Skeleton variant="rounded" width={16} height={16} />
      </div>
      <Skeleton variant="text" width="60%" height={28} style={{ marginTop: 8 }} />
      <Skeleton variant="text" width="40%" height={16} />
    </div>
  );
}

function PayablesRowSkeleton(): React.JSX.Element {
  return (
    <tr>
      <td className="lumio-payable-list__td">
        <Skeleton variant="text" width="70%" height={18} />
      </td>
      <td className="lumio-payable-list__td">
        <Skeleton variant="text" width="60%" height={16} />
      </td>
      <td className="lumio-payable-list__td">
        <Skeleton variant="text" width="60%" height={16} />
      </td>
      <td className="lumio-payable-list__td">
        <Skeleton variant="rounded" width={72} height={22} />
      </td>
      <td className="lumio-payable-list__td" style={{ textAlign: 'right' }}>
        <Skeleton variant="text" width={80} height={18} style={{ marginLeft: 'auto' }} />
      </td>
      <td className="lumio-payable-list__td">
        <Skeleton variant="rounded" width={120} height={28} style={{ marginLeft: 'auto' }} />
      </td>
    </tr>
  );
}

function PayablesViewSkeleton(): React.JSX.Element {
  return (
    <div className="container-shared lumio-stmt-list">
      <div className="lumio-stat-tiles">
        {SUMMARY_CARD_KEYS.map(key => (
          <PayablesSummaryCardSkeleton key={key} />
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <table style={{ minWidth: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <tbody>
            {PAYABLE_ROW_KEYS.map(key => (
              <PayablesRowSkeleton key={key} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// eslint-disable-next-line complexity
const getErrorMessage = (error: unknown, fallback: string): string => {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const candidate = error as {
    response?: { data?: { message?: string | string[]; error?: { message?: string } | string } };
    message?: string;
  };

  const message = candidate.response?.data?.message;
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  if (typeof message === 'string' && message.trim()) {
    return message;
  }
  if (typeof candidate.response?.data?.error === 'string' && candidate.response.data.error.trim()) {
    return candidate.response.data.error;
  }
  if (
    candidate.response?.data?.error &&
    typeof candidate.response.data.error === 'object' &&
    typeof candidate.response.data.error.message === 'string'
  ) {
    return candidate.response.data.error.message;
  }
  if (typeof candidate.message === 'string' && candidate.message.trim()) {
    return candidate.message;
  }
  return fallback;
};

type PayablesViewProps = {
  /** Which side of the ledger this view manages. Defaults to money the workspace owes. */
  direction?: PayableDirection;
};

// eslint-disable-next-line max-lines-per-function, complexity
export function PayablesView({ direction = 'payable' }: PayablesViewProps = {}): React.JSX.Element {
  const searchParams = useSearchParams();
  useAttentionFocus();
  const { user, loading: authLoading } = useAuth();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const { locale } = useLocale();
  const router = useRouter();
  const t = useIntlayer('statementsPage');
  const tx = useCallback(
    (path: string[], fallback: string) => resolveLabel(getNestedValue(t, path), fallback),
    [t],
  );
  // Receivables reuse the payables screen; only the wording that names the counterparty
  // or the money flow switches, and it lives under the `receivables` content key.
  const dx = useCallback(
    (path: string[], payableFallback: string, receivableFallback: string) =>
      direction === 'receivable'
        ? tx(['receivables', ...path], receivableFallback)
        : tx(['payables', ...path], payableFallback),
    [direction, tx],
  );
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState<PayablesSummary>(DEFAULT_SUMMARY);
  const [items, setItems] = useState<Payable[]>([]);
  const [filters, setFilters] = useState<PayablesFiltersState>(DEFAULT_PAYABLES_FILTERS);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [, setRefreshing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPayable, setEditingPayable] = useState<Payable | null>(null);
  const [saving, setSaving] = useState(false);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);
  const [payingPayable, setPayingPayable] = useState<Payable | null>(null);
  const [removingPaymentId, setRemovingPaymentId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [queryPage, setQueryPage] = useState(1);
  const requestVersionRef = useRef(0);

  useEffect(() => {
    const status = searchParams?.get('status');
    const source = searchParams?.get('source');

    const nextFilters = {
      ...DEFAULT_PAYABLES_FILTERS,
      status:
        status === 'to_pay' ||
        status === 'scheduled' ||
        status === 'partially_paid' ||
        status === 'paid' ||
        status === 'overdue' ||
        status === 'archived'
          ? status
          : DEFAULT_PAYABLES_FILTERS.status,
      source:
        source === 'manual' || source === 'invoice' || source === 'statement'
          ? source
          : DEFAULT_PAYABLES_FILTERS.source,
    } satisfies PayablesFiltersState;

    setFilters(current => {
      if (
        current.search === nextFilters.search &&
        current.status === nextFilters.status &&
        current.source === nextFilters.source &&
        current.dueDateFrom === nextFilters.dueDateFrom &&
        current.dueDateTo === nextFilters.dueDateTo &&
        current.sort === nextFilters.sort
      ) {
        return current;
      }

      return nextFilters;
    });
    setPage(1);
    setQueryPage(1);
  }, [searchParams]);

  const labels = useMemo(
    () => ({
      title: dx(['title'], 'Payables', 'Receivables'),
      subtitle: dx(
        ['subtitle'],
        'Track upcoming payments, overdue bills, and paid expenses in one queue.',
        'Track money owed to you: upcoming, overdue, and already received payments.',
      ),
      add: dx(['add'], 'Add payable', 'Add receivable'),
      export: tx(['payables', 'export'], 'Export'),
      summary: {
        toPay: dx(['summary', 'toPay'], 'To Pay', 'To Receive'),
        overdue: tx(['payables', 'summary', 'overdue'], 'Overdue'),
        dueThisWeek: tx(['payables', 'summary', 'dueThisWeek'], 'Due This Week'),
        paidTotal: dx(['summary', 'paidThisMonth'], 'Paid', 'Received'),
        itemsSuffix: tx(['payables', 'summary', 'itemsSuffix'], 'items'),
      },
      filters: {
        status: tx(['payables', 'filters', 'status'], 'Status'),
        source: tx(['payables', 'filters', 'source'], 'Source'),
        dueFrom: tx(['payables', 'filters', 'dueFrom'], 'Due from'),
        dueTo: tx(['payables', 'filters', 'dueTo'], 'Due to'),
        sort: tx(['payables', 'filters', 'sort'], 'Sort'),
        reset: tx(['payables', 'filters', 'reset'], 'Reset'),
        allStatuses: tx(['payables', 'filters', 'allStatuses'], 'All statuses'),
        allSources: tx(['payables', 'filters', 'allSources'], 'All sources'),
        statusOptions: {
          to_pay: dx(['status', 'toPay'], 'To pay', 'To receive'),
          scheduled: tx(['payables', 'status', 'scheduled'], 'Scheduled'),
          partially_paid: dx(['status', 'partiallyPaid'], 'Partially paid', 'Partially received'),
          paid: dx(['status', 'paid'], 'Paid', 'Received'),
          overdue: tx(['payables', 'status', 'overdue'], 'Overdue'),
          archived: tx(['payables', 'status', 'archived'], 'Archived'),
        },
        sourceOptions: {
          manual: tx(['payables', 'sources', 'manual'], 'Manual'),
          invoice: tx(['payables', 'sources', 'invoice'], 'Invoice'),
          statement: tx(['payables', 'sources', 'statement'], 'Statement'),
        },
        sortOptions: {
          dueDateAsc: tx(['payables', 'sort', 'dueDateAsc'], 'Due date (earliest)'),
          dueDateDesc: tx(['payables', 'sort', 'dueDateDesc'], 'Due date (latest)'),
          amountDesc: tx(['payables', 'sort', 'amountDesc'], 'Amount (highest)'),
          vendorAsc: dx(['sort', 'vendorAsc'], 'Vendor (A-Z)', 'Customer (A-Z)'),
        },
      },
      list: {
        vendor: dx(['list', 'vendor'], 'Vendor', 'Customer'),
        dueDate: tx(['payables', 'list', 'dueDate'], 'Due date'),
        amount: tx(['payables', 'list', 'amount'], 'Amount'),
        source: tx(['payables', 'list', 'source'], 'Source'),
        status: tx(['payables', 'list', 'status'], 'Status'),
        actions: tx(['payables', 'list', 'actions'], 'Actions'),
        markPaid: dx(['actions', 'markPaid'], 'Mark paid', 'Mark received'),
        edit: tx(['payables', 'actions', 'edit'], 'Edit'),
        archive: tx(['payables', 'actions', 'archive'], 'Archive'),
        delete: tx(['payables', 'actions', 'delete'], 'Delete'),
        pageShown: tx(['pagination', 'shown'], 'Showing {from}–{to} of {count}'),
        previous: tx(['pagination', 'previous'], 'Previous'),
        next: tx(['pagination', 'next'], 'Next'),
        pageOf: tx(['pagination', 'pageOf'], 'Page {page} of {count}'),
        statusLabels: {
          to_pay: dx(['status', 'toPay'], 'To pay', 'To receive'),
          scheduled: tx(['payables', 'status', 'scheduled'], 'Scheduled'),
          partially_paid: dx(['status', 'partiallyPaid'], 'Partially paid', 'Partially received'),
          paid: dx(['status', 'paid'], 'Paid', 'Received'),
          overdue: tx(['payables', 'status', 'overdue'], 'Overdue'),
          archived: tx(['payables', 'status', 'archived'], 'Archived'),
        },
        amountPaid: dx(['list', 'amountPaid'], 'paid', 'received'),
        sourceLabels: {
          manual: tx(['payables', 'sources', 'manual'], 'Manual'),
          invoice: tx(['payables', 'sources', 'invoice'], 'Invoice'),
          statement: tx(['payables', 'sources', 'statement'], 'Statement'),
        },
      },
      drawer: {
        createTitle: dx(['drawer', 'createTitle'], 'Create payable', 'Create receivable'),
        editTitle: dx(['drawer', 'editTitle'], 'Edit payable', 'Edit receivable'),
        vendor: dx(['drawer', 'vendor'], 'Vendor', 'Customer'),
        amount: tx(['payables', 'drawer', 'amount'], 'Amount'),
        currency: tx(['payables', 'drawer', 'currency'], 'Currency'),
        dueDate: tx(['payables', 'drawer', 'dueDate'], 'Due date'),
        source: tx(['payables', 'drawer', 'source'], 'Source'),
        status: tx(['payables', 'drawer', 'status'], 'Status'),
        comment: tx(['payables', 'drawer', 'comment'], 'Comment'),
        save: tx(['payables', 'drawer', 'save'], 'Save'),
        saving: tx(['payables', 'drawer', 'saving'], 'Saving...'),
        cancel: tx(['payables', 'drawer', 'cancel'], 'Cancel'),
        sourceOptions: {
          manual: tx(['payables', 'sources', 'manual'], 'Manual'),
          invoice: tx(['payables', 'sources', 'invoice'], 'Invoice'),
          statement: tx(['payables', 'sources', 'statement'], 'Statement'),
        },
        statusOptions: {
          to_pay: dx(['status', 'toPay'], 'To pay', 'To receive'),
          scheduled: tx(['payables', 'status', 'scheduled'], 'Scheduled'),
          paid: dx(['status', 'paid'], 'Paid', 'Received'),
          overdue: tx(['payables', 'status', 'overdue'], 'Overdue'),
          archived: tx(['payables', 'status', 'archived'], 'Archived'),
        },
      },
      emptyTitle: dx(['empty', 'title'], 'No payables found', 'No receivables found'),
      emptyDescription: dx(
        ['empty', 'description'],
        'Try changing filters or create your first payable.',
        'Try changing filters or add money someone owes you.',
      ),
      authLoading: tx(['payables', 'auth', 'loading'], 'Loading...'),
      loginRequired: dx(
        ['auth', 'loginRequired'],
        'Please sign in to view payables.',
        'Please sign in to view receivables.',
      ),
      noWorkspace: dx(
        ['auth', 'workspaceRequired'],
        'Select a workspace to view payables.',
        'Select a workspace to view receivables.',
      ),
      toasts: {
        loadFailed: dx(
          ['toasts', 'loadFailed'],
          'Failed to load payables',
          'Failed to load receivables',
        ),
        createSuccess: dx(['toasts', 'createSuccess'], 'Payable created', 'Receivable created'),
        createFailed: dx(
          ['toasts', 'createFailed'],
          'Failed to create payable',
          'Failed to create receivable',
        ),
        updateSuccess: dx(['toasts', 'updateSuccess'], 'Payable updated', 'Receivable updated'),
        updateFailed: dx(
          ['toasts', 'updateFailed'],
          'Failed to update payable',
          'Failed to update receivable',
        ),
        markPaidSuccess: dx(['toasts', 'markPaidSuccess'], 'Marked as paid', 'Marked as received'),
        markPaidFailed: dx(
          ['toasts', 'markPaidFailed'],
          'Failed to mark payable as paid',
          'Failed to mark receivable as received',
        ),
        archiveSuccess: dx(['toasts', 'archiveSuccess'], 'Payable archived', 'Receivable archived'),
        archiveFailed: dx(
          ['toasts', 'archiveFailed'],
          'Failed to archive payable',
          'Failed to archive receivable',
        ),
        deleteSuccess: dx(['toasts', 'deleteSuccess'], 'Payable deleted', 'Receivable deleted'),
        deleteFailed: dx(
          ['toasts', 'deleteFailed'],
          'Failed to delete payable',
          'Failed to delete receivable',
        ),
        deleteConfirm: tx(['payables', 'toasts', 'deleteConfirm'], 'Delete {vendor}?'),
      },
    }),
    [dx, tx],
  );

  const loadData = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!(user && currentWorkspace)) {
        setLoading(false);
        return;
      }

      if (options?.silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const requestVersion = ++requestVersionRef.current;

      return await (async () => {
        const [summaryResponse, listResponse] = await Promise.all([
          payablesApi.getSummary(direction),
          payablesApi.list(
            buildPayablesListParams(filters, {
              page: queryPage,
              limit: PAGE_SIZE,
              direction,
            }) as ListPayablesParams,
          ),
        ]);

        if (requestVersion !== requestVersionRef.current) {
          return;
        }

        const nextTotalPages = Math.max(1, listResponse.totalPages || 1);

        if (listResponse.total > 0 && queryPage > nextTotalPages) {
          setPage(nextTotalPages);
          setQueryPage(nextTotalPages);
          return;
        }

        setSummary(summaryResponse);
        setItems(listResponse.data);
        setTotal(listResponse.total);
        setTotalPages(nextTotalPages);
        setPage(Math.min(queryPage, nextTotalPages));
      })()
        .catch(async error => {
          if (requestVersion !== requestVersionRef.current) {
            return;
          }
          toast.error(getErrorMessage(error, labels.toasts.loadFailed));
        })
        .finally(async () => {
          if (requestVersion === requestVersionRef.current) {
            setLoading(false);
            setRefreshing(false);
          }
        });
    },
    [currentWorkspace, direction, filters, labels.toasts.loadFailed, queryPage, user],
  );

  useEffect(() => {
    if (authLoading || workspaceLoading) {
      return;
    }
    void loadData();
  }, [authLoading, workspaceLoading, loadData]);

  const handleFiltersChange = useCallback((next: PayablesFiltersState) => {
    setFilters(next);
    setPage(1);
    setQueryPage(1);
  }, []);

  const handlePageChange = useCallback((nextPage: number) => {
    setPage(nextPage);
    setQueryPage(nextPage);
  }, []);

  const openCreateDrawer = (): void => {
    setEditingPayable(null);
    setDrawerOpen(true);
  };

  const handleEdit = async (payable: Payable): Promise<void> => {
    await (async () => {
      const fresh = await payablesApi.getOne(payable.id);
      setEditingPayable(fresh);
      setDrawerOpen(true);
    })().catch(async error => {
      toast.error(getErrorMessage(error, labels.toasts.loadFailed));
    });
  };

  const handleSave = async (payload: CreatePayableInput | UpdatePayableInput): Promise<void> => {
    setSaving(true);

    await (async () => {
      if (editingPayable) {
        await payablesApi.update(editingPayable.id, payload as UpdatePayableInput);
        toast.success(labels.toasts.updateSuccess);
      } else {
        await payablesApi.create({ ...(payload as CreatePayableInput), direction });
        toast.success(labels.toasts.createSuccess);
      }

      setDrawerOpen(false);
      setEditingPayable(null);
      await loadData({ silent: true });
    })()
      .catch(async error => {
        toast.error(
          getErrorMessage(
            error,
            editingPayable ? labels.toasts.updateFailed : labels.toasts.createFailed,
          ),
        );
      })
      .finally(async () => {
        setSaving(false);
      });
  };

  const handleMarkPaid = async (payable: Payable): Promise<void> => {
    setPayingPayable(payable);
  };

  const confirmMarkPaid = async (payable: Payable, result: MarkPaidResult): Promise<void> => {
    setMarkingPaidId(payable.id);

    await (async () => {
      const updated =
        result.kind === 'full'
          ? await payablesApi.markAsPaid(payable.id, result.payload)
          : await payablesApi.addPayment(payable.id, result.payload);
      // A bill that is still short keeps the dialog open on its new outstanding
      // amount: instalments arrive one after another.
      setPayingPayable(updated.status === 'partially_paid' ? updated : null);
      queryClient.invalidateQueries({
        queryKey: queryKeys.payablePayments({ workspaceId, payableId: payable.id }),
      });
      toast.success(labels.toasts.markPaidSuccess);
      await loadData({ silent: true });
    })()
      .catch(async error => {
        // The payment refusals are coded, so they read in the user's language.
        toast.error(getApiErrorMessage(error, labels.toasts.markPaidFailed));
      })
      .finally(async () => {
        setMarkingPaidId(null);
      });
  };

  const removePayment = async (payable: Payable, paymentId: string): Promise<void> => {
    setRemovingPaymentId(paymentId);

    await (async () => {
      const updated = await payablesApi.removePayment(payable.id, paymentId);
      setPayingPayable(updated);
      queryClient.invalidateQueries({
        queryKey: queryKeys.payablePayments({ workspaceId, payableId: payable.id }),
      });
      await loadData({ silent: true });
    })()
      .catch(async error => {
        toast.error(getApiErrorMessage(error, labels.toasts.markPaidFailed));
      })
      .finally(async () => {
        setRemovingPaymentId(null);
      });
  };

  const handleArchive = async (payable: Payable): Promise<void> => {
    setArchivingId(payable.id);

    await (async () => {
      await payablesApi.archive(payable.id);
      toast.success(labels.toasts.archiveSuccess);
      await loadData({ silent: true });
    })()
      .catch(async error => {
        toast.error(getErrorMessage(error, labels.toasts.archiveFailed));
      })
      .finally(async () => {
        setArchivingId(null);
      });
  };

  const handleDelete = async (payable: Payable): Promise<void> => {
    const confirmMessage = labels.toasts.deleteConfirm.replace('{vendor}', payable.vendor);
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeletingId(payable.id);

    await (async () => {
      await payablesApi.delete(payable.id);
      toast.success(labels.toasts.deleteSuccess);
      await loadData({ silent: true });
    })()
      .catch(async error => {
        toast.error(getErrorMessage(error, labels.toasts.deleteFailed));
      })
      .finally(async () => {
        setDeletingId(null);
      });
  };

  if (authLoading || workspaceLoading || loading) {
    return <PayablesViewSkeleton />;
  }

  if (!user) {
    return (
      <div className="container-shared" style={{ padding: '40px 16px' }}>
        <div
          style={{
            borderRadius: tokens.radius.lg,
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            padding: 24,
            fontSize: 14,
            color: 'var(--text-secondary)',
          }}
        >
          {labels.loginRequired}
        </div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="container-shared" style={{ padding: '40px 16px' }}>
        <div
          style={{
            borderRadius: tokens.radius.lg,
            border: '1px solid var(--border-color)',
            background: 'var(--card-bg)',
            padding: 24,
            fontSize: 14,
            color: 'var(--text-secondary)',
          }}
        >
          {labels.noWorkspace}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="container-shared lumio-stmt-list">
        <div
          style={{
            marginBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <StatementsQueueTabs />
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 12,
                  flexShrink: 0,
                }}
              >
                <PayableFiltersBar
                  value={filters}
                  onChange={handleFiltersChange}
                  onReset={() => handleFiltersChange(DEFAULT_PAYABLES_FILTERS)}
                  labels={labels.filters}
                />
                {/* Keeps the primary actions from reading as more filter buttons. */}
                <span
                  aria-hidden
                  style={{
                    width: 1,
                    alignSelf: 'stretch',
                    minHeight: 24,
                    background: 'var(--border-color)',
                    flexShrink: 0,
                  }}
                />
                <Button variant="outline" onClick={() => router.push('/statements/reconcile')}>
                  {tx(['payables', 'reconcile'], 'Reconcile with the bank')}
                </Button>
                <Button onClick={openCreateDrawer}>{labels.add}</Button>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            minHeight: 0,
            flex: 1,
            flexDirection: 'column',
            gap: 16,
            overflowY: 'auto',
            paddingBottom: 8,
          }}
        >
          <PayableSummaryCards
            summary={summary}
            locale={locale}
            currency={(currentWorkspace.currency || FALLBACK_CURRENCY).toUpperCase()}
            labels={labels.summary}
          />

          <PayablesList
            items={items}
            locale={locale}
            emptyTitle={labels.emptyTitle}
            emptyDescription={labels.emptyDescription}
            emptyIllustration={direction === 'receivable' ? 'receivables' : 'payables'}
            labels={labels.list}
            pagination={{
              page,
              totalPages,
              totalItems: total,
              pageSize: PAGE_SIZE,
              onPageChange: handlePageChange,
            }}
            actionState={{ markingPaidId, archivingId, deletingId }}
            onEdit={handleEdit}
            onMarkPaid={handleMarkPaid}
            onArchive={handleArchive}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <MarkPaidDialog
        removingPaymentId={removingPaymentId}
        onRemovePayment={(payable, paymentId) => void removePayment(payable, paymentId)}
        payable={payingPayable}
        submitting={markingPaidId !== null}
        onClose={() => setPayingPayable(null)}
        onConfirm={(payable, result) => void confirmMarkPaid(payable, result)}
      />

      <CreatePayableDrawer
        open={drawerOpen}
        payable={editingPayable}
        defaultCurrency={(currentWorkspace.currency || FALLBACK_CURRENCY).toUpperCase()}
        saving={saving}
        onClose={() => {
          setDrawerOpen(false);
          setEditingPayable(null);
        }}
        onSubmit={handleSave}
        labels={labels.drawer}
      />
    </>
  );
}
