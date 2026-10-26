import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type {
  SubscriptionChargeCalendar as ChargeCalendarContract,
  SubscriptionItem as SubscriptionRow,
  SubscriptionSummary as SummaryContract,
} from '@/app/lib/contracts';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import type { PaymentEntry } from '../components/SubscriptionPayments';
import { vendorDomainForSave } from '../components/vendor-domain.utils';
import {
  clearSubscriptionDraft,
  readSubscriptionDraft,
  saveSubscriptionDraft,
} from './subscription-draft';

export type SubscriptionChargeCalendar = ChargeCalendarContract;
export type SubscriptionSummary = SummaryContract;

/**
 * A subscription as the page uses it. The API sends the money columns as
 * decimal strings; they are turned into numbers once, when the list loads.
 */
export type SubscriptionItem = Omit<
  SubscriptionRow,
  'amount' | 'realizedAnnualSavings' | 'confidence'
> & {
  amount: number;
  realizedAnnualSavings: number;
  confidence: number | null;
};

export function normalizeSubscription(row: SubscriptionRow): SubscriptionItem {
  return {
    ...row,
    amount: Number(row.amount),
    realizedAnnualSavings: Number(row.realizedAnnualSavings),
    confidence: row.confidence === null ? null : Number(row.confidence),
  };
}

export interface SubscriptionPriceChange {
  previous: number;
  current: number;
  delta: number;
  yearlyDelta: number;
  detectedAt: string;
}

export function priceChangeOf(subscription: SubscriptionItem): SubscriptionPriceChange | null {
  const change = subscription.detectionMeta?.priceChange as SubscriptionPriceChange | undefined;
  return change && typeof change.current === 'number' ? change : null;
}

export interface SubscriptionWorkspaceMember {
  id: string;
  name?: string | null;
  email?: string | null;
}

export interface SubscriptionFormData {
  vendorName: string;
  amount: number | '';
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  currency: string;
  categoryId: string;
  nextChargeDate: string;
  vendorDomain: string;
  /** The budget its money comes out of; empty for none. */
  budgetId: string;
  /** Payments already made, saved right after the subscription is created. */
  payments: PendingPayment[];
}

/** A payment picked in the add form: typed in, or a bank row (`transactionId`). */
export type PendingPayment = PaymentEntry & { transactionId: string | null };

/** The id of the subscription `POST /subscriptions` answered with. */
const readCreatedId = (response: unknown): string | null => {
  const data =
    response && typeof response === 'object' && 'data' in response ? response.data : null;
  const id = data && typeof data === 'object' && 'id' in data ? data.id : null;
  return typeof id === 'string' ? id : null;
};

const DEFAULT_CURRENCY = 'USD';
const CALENDAR_MONTHS = 6;

const EMPTY_CALENDAR: SubscriptionChargeCalendar = {
  currency: null,
  months: [],
  monthTotals: [],
  rows: [],
};

const EMPTY_SUMMARY: SubscriptionSummary = {
  totalMonthlyCost: 0,
  activeCount: 0,
  upcomingCount: 0,
  upcoming30DaysCount: 0,
  upcoming30DaysAmount: 0,
  priceChangeCount: 0,
  priceChangeYearlyEffect: 0,
  duplicateCount: 0,
  overdueReviewCount: 0,
  realizedAnnualSavings: 0,
};

const makeEmptyForm = (currency: string): SubscriptionFormData => ({
  vendorName: '',
  amount: '',
  frequency: 'monthly',
  currency,
  categoryId: '',
  nextChargeDate: '',
  vendorDomain: '',
  budgetId: '',
  payments: [],
});

export function useSubscriptionsPage() {
  const text = useIntlayer('subscriptionsPage');
  const paymentsText = useIntlayer('subscriptionPayments');
  const { currentWorkspace } = useWorkspace();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const workspaceCurrency = currentWorkspace?.currency ?? DEFAULT_CURRENCY;

  const [workspaceMembers, setWorkspaceMembers] = useState<SubscriptionWorkspaceMember[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<SubscriptionItem | null>(null);
  const [formData, setFormData] = useState<SubscriptionFormData>(() =>
    makeEmptyForm(workspaceCurrency),
  );

  const listQuery = useQuery({
    queryKey: queryKeys.subscriptions({ workspaceId, status: statusFilter }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/subscriptions',
        params: statusFilter !== 'all' ? { status: statusFilter } : undefined,
        signal,
        contract: 'SubscriptionList',
      }).then(rows => rows.map(normalizeSubscription)),
    // Смена фильтра статуса не должна стирать список: старые карточки живут на
    // экране до прихода новых, но только внутри того же воркспейса.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
    enabled: Boolean(workspaceId),
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.subscriptionsSummary(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/subscriptions/summary', signal, contract: 'SubscriptionSummary' }),
    enabled: Boolean(workspaceId),
  });

  // Deliberately not derived from `listQuery`: the calendar shows the whole
  // workspace's active spend, so it must not follow the status tab or the
  // client-side filters, and its amounts come converted by the same service as
  // the monthly-cost summary.
  const calendarQuery = useQuery({
    queryKey: queryKeys.subscriptionsChargeCalendar({ workspaceId, months: CALENDAR_MONTHS }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/subscriptions/charge-calendar',
        params: { months: CALENDAR_MONTHS } satisfies ContractInput<'ChargeCalendarQuery'>,
        signal,
        contract: 'SubscriptionChargeCalendar',
      }),
    enabled: Boolean(workspaceId),
  });

  const invalidate = useCallback((): Promise<void> => {
    return queryClient.invalidateQueries({ queryKey: ['subscriptions', workspaceId] });
  }, [queryClient, workspaceId]);

  /**
   * Действия строки отличаются только запросом и текстом тоста, поэтому живут
   * в одной мутации: отдельный `saveMutation` нужен лишь затем, чтобы спиннер
   * в диалоге не загорался от действий в списке.
   */
  const rowMutation = useMutation({
    mutationFn: (action: { run: () => Promise<unknown>; success: string; failure: string }) =>
      action.run(),
    onSuccess: (_result, action) => toast.success(action.success),
    onError: (_error, action) => toast.error(action.failure),
    onSettled: invalidate,
  });

  const saveMutation = useMutation({
    mutationFn: (action: { run: () => Promise<unknown>; success: string; failure: string }) =>
      action.run(),
    onSuccess: (_result, action) => toast.success(action.success),
    onError: (_error, action) => toast.error(action.failure),
    onSettled: invalidate,
  });

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    void apiQueryDecoded({
      url: `/workspaces/${currentWorkspace.id}`,
      contract: 'WorkspaceDetail',
    })
      .then(workspace => {
        setWorkspaceMembers(workspace.members);
      })
      .catch(() => setWorkspaceMembers([]));
  }, [currentWorkspace?.id]);

  const openCreate = useCallback(() => {
    setEditingSubscription(null);
    setFormData(
      (workspaceId && readSubscriptionDraft(workspaceId)) || makeEmptyForm(workspaceCurrency),
    );
    setDialogOpen(true);
  }, [workspaceCurrency, workspaceId]);

  // The add form survives a drawer closed by mistake or a reload; editing does not need it.
  useEffect(() => {
    if (!dialogOpen || editingSubscription || !workspaceId) return;
    const empty = makeEmptyForm(workspaceCurrency);
    const touched =
      formData.vendorName !== empty.vendorName ||
      formData.amount !== empty.amount ||
      formData.nextChargeDate !== empty.nextChargeDate ||
      formData.payments.length > 0;
    // Emptied again: nothing to bring back.
    if (touched) saveSubscriptionDraft(workspaceId, formData);
    else clearSubscriptionDraft();
  }, [dialogOpen, editingSubscription, formData, workspaceId, workspaceCurrency]);

  const openEdit = useCallback((sub: SubscriptionItem) => {
    setEditingSubscription(sub);
    setFormData({
      vendorName: sub.vendorName,
      amount: sub.amount,
      frequency: sub.frequency,
      currency: sub.currency,
      categoryId: sub.categoryId ?? '',
      nextChargeDate: sub.nextChargeDate ?? '',
      vendorDomain: sub.vendorDomain ?? '',
      budgetId: sub.budgetId ?? '',
      // Payments of a saved subscription live in its card.
      payments: [],
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingSubscription(null);
  }, []);

  // The subscription is already saved: a payment that fails is reported on its
  // own and can be added again from the card.
  const savePendingPayments = useCallback(
    async (subscriptionId: string, payments: PendingPayment[]) => {
      for (const payment of payments) {
        const body = payment.transactionId
          ? { transactionId: payment.transactionId }
          : { chargeDate: payment.date, amount: payment.amount };
        await apiClient
          .post(
            `/subscriptions/${subscriptionId}/charges`,
            body satisfies ContractInput<'RecordSubscriptionChargeBody'>,
          )
          .catch(() => toast.error(paymentsText.paymentFailed.value));
      }
      await invalidate();
    },
    [invalidate, paymentsText],
  );

  const handleSave = useCallback(async () => {
    if (!(formData.vendorName && formData.amount)) return;

    const payload = {
      vendorName: formData.vendorName,
      amount: Number(formData.amount),
      frequency: formData.frequency,
      currency: formData.currency || workspaceCurrency,
      categoryId: formData.categoryId || undefined,
      nextChargeDate: formData.nextChargeDate || undefined,
      // null unlinks on an edit; on a new one it is simply none.
      budgetId: formData.budgetId || null,
      vendorDomain: vendorDomainForSave(
        formData.vendorName,
        editingSubscription?.vendorName,
        formData.vendorDomain,
      ),
    };
    const editingId = editingSubscription?.id;

    await saveMutation
      .mutateAsync({
        run: () =>
          editingId
            ? apiClient.put(
                `/subscriptions/${editingId}`,
                payload satisfies ContractInput<'UpdateSubscriptionBody'>,
              )
            : apiClient.post(
                '/subscriptions',
                payload satisfies ContractInput<'CreateSubscriptionBody'>,
              ),
        success: editingId ? text.toastUpdated.value : text.toastCreated.value,
        failure: text.toastSaveFailed.value,
      })
      // Диалог закрывается только после успеха: при ошибке форма остаётся
      // заполненной, как и до миграции.
      .then(async response => {
        const createdId = editingId ? null : readCreatedId(response);
        if (!editingId) clearSubscriptionDraft();
        if (createdId && formData.payments.length > 0) {
          await savePendingPayments(createdId, formData.payments);
        }
        closeDialog();
      })
      .catch(() => undefined);
  }, [
    formData,
    editingSubscription,
    closeDialog,
    savePendingPayments,
    saveMutation.mutateAsync,
    workspaceCurrency,
    text,
  ]);

  const handleDelete = useCallback(
    async (id: string) => {
      rowMutation.mutate({
        run: () => apiClient.delete(`/subscriptions/${id}`),
        success: text.toastDeleted.value,
        failure: text.toastDeleteFailed.value,
      });
    },
    [rowMutation.mutate, text],
  );

  const handleConfirm = useCallback(
    async (id: string) => {
      rowMutation.mutate({
        run: () => apiClient.post(`/subscriptions/${id}/confirm`),
        success: text.toastConfirmed.value,
        failure: text.toastConfirmFailed.value,
      });
    },
    [rowMutation.mutate, text],
  );

  const handleDismiss = useCallback(
    async (id: string) => {
      rowMutation.mutate({
        run: () => apiClient.post(`/subscriptions/${id}/dismiss`),
        success: text.toastDismissed.value,
        failure: text.toastDismissFailed.value,
      });
    },
    [rowMutation.mutate, text],
  );

  const duplicatesQuery = useQuery({
    queryKey: queryKeys.subscriptionsDuplicates(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/subscriptions/duplicates',
        signal,
        contract: 'SubscriptionDuplicateGroups',
      }),
    enabled: Boolean(workspaceId),
  });
  const duplicateIds = useMemo(
    () => new Set((duplicatesQuery.data ?? []).flatMap(group => group.items.map(item => item.id))),
    [duplicatesQuery.data],
  );

  const recordUsage = useCallback(
    async (id: string) => {
      rowMutation.mutate({
        run: () => apiClient.post(`/subscriptions/${id}/usage`),
        success: text.toastUsageSaved.value,
        failure: text.toastDecisionFailed.value,
      });
    },
    [rowMutation.mutate, text],
  );

  const createSinkingFund = useCallback(
    async (id: string) => {
      rowMutation.mutate({
        run: () => apiClient.post(`/subscriptions/${id}/sinking-fund`),
        success: text.sinkingFundGoal.value,
        failure: text.toastSinkingFundFailed.value,
      });
    },
    [rowMutation.mutate, text],
  );

  // Pause, resume or bring back a cancelled one: the status alone, nothing decided.
  const setStatus = useCallback(
    async (id: string, status: 'active' | 'paused') => {
      rowMutation.mutate({
        run: () =>
          apiClient.put(`/subscriptions/${id}`, {
            status,
          } satisfies ContractInput<'UpdateSubscriptionBody'>),
        success: text.toastUpdated.value,
        failure: text.toastSaveFailed.value,
      });
    },
    [rowMutation.mutate, text],
  );

  const recordDecision = useCallback(
    async (
      id: string,
      decision: 'keep' | 'review' | 'cancelled' | 'price_reduced',
      values: { note?: string; reviewAt?: string; realizedAnnualSavings?: number } = {},
    ) => {
      rowMutation.mutate({
        run: () =>
          apiClient.post(`/subscriptions/${id}/decisions`, {
            decision,
            ...values,
          } satisfies ContractInput<'RecordSubscriptionDecisionBody'>),
        success: text.toastDecisionSaved.value,
        failure: text.toastDecisionFailed.value,
      });
    },
    [rowMutation.mutate, text],
  );

  return {
    subscriptions: listQuery.data ?? [],
    summary: summaryQuery.data ?? EMPTY_SUMMARY,
    chargeCalendar: calendarQuery.data ?? EMPTY_CALENDAR,
    workspaceMembers,
    workspaceCurrency,
    isPending: listQuery.isPending,
    isFetching: listQuery.isFetching || rowMutation.isPending,
    error: listQuery.isError ? text.loadFailed.value : null,
    statusFilter,
    setStatusFilter,
    dialogOpen,
    editingSubscription,
    formData,
    setFormData,
    saving: saveMutation.isPending,
    openCreate,
    invalidate,
    openEdit,
    closeDialog,
    handleSave,
    handleDelete,
    handleConfirm,
    handleDismiss,
    recordDecision,
    setStatus,
    recordUsage,
    createSinkingFund,
    duplicateIds,
  };
}
