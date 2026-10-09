import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { apiQuery } from '@/app/lib/query-fn';
import { queryKeys } from '@/app/lib/query-keys';
import { guessVendorDomain } from '../components/vendor-domain.utils';

export interface SubscriptionItem {
  id: string;
  vendorName: string;
  vendorRaw: string | null;
  vendorDomain: string | null;
  amount: number;
  currency: string;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  status: 'detected' | 'active' | 'paused' | 'cancelled';
  ownerId: string | null;
  owner: { id: string; name: string | null; email: string | null } | null;
  reviewAt: string | null;
  reviewStatus: 'current' | 'needs_review';
  riskStatus: 'none' | 'price_changed' | 'date_shifted' | 'missing_charge';
  cancellationReason: string | null;
  realizedAnnualSavings: number;
  confidence: number | null;
  nextChargeDate: string | null;
  lastChargeDate: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  detectionMeta: Record<string, unknown> | null;
  createdAt: string;
  usageCount?: number;
  usageSince?: string | null;
  lastUsedAt?: string | null;
  sinkingGoalId?: string | null;
  /** Computed by the API from the taps since the counter started; null until the first tap. */
  costPerUse?: number | null;
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

export interface SubscriptionSummary {
  totalMonthlyCost: number;
  activeCount: number;
  upcomingCount: number;
  upcoming30DaysCount: number;
  priceChangeCount: number;
  priceChangeYearlyEffect?: number;
  duplicateCount?: number;
  overdueReviewCount: number;
  realizedAnnualSavings: number;
}

export interface SubscriptionChargeCalendar {
  currency: string | null;
  months: string[];
  monthTotals: number[];
  rows: {
    subscriptionId: string;
    vendorName: string;
    vendorDomain: string | null;
    amounts: number[];
    kind?: 'subscription' | 'payable' | 'invoice';
  }[];
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
}

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
  priceChangeCount: 0,
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
});

export function useSubscriptionsPage() {
  const text = useIntlayer('subscriptionsPage');
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
      apiQuery<SubscriptionItem[]>({
        url: '/subscriptions',
        params: statusFilter !== 'all' ? { status: statusFilter } : undefined,
        signal,
      }),
    // Смена фильтра статуса не должна стирать список: старые карточки живут на
    // экране до прихода новых, но только внутри того же воркспейса.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });

  const summaryQuery = useQuery({
    queryKey: queryKeys.subscriptionsSummary(workspaceId),
    queryFn: ({ signal }) =>
      apiQuery<SubscriptionSummary>({ url: '/subscriptions/summary', signal }),
  });

  // Deliberately not derived from `listQuery`: the calendar shows the whole
  // workspace's active spend, so it must not follow the status tab or the
  // client-side filters, and its amounts come converted by the same service as
  // the monthly-cost summary.
  const calendarQuery = useQuery({
    queryKey: queryKeys.subscriptionsChargeCalendar({ workspaceId, months: CALENDAR_MONTHS }),
    queryFn: ({ signal }) =>
      apiQuery<SubscriptionChargeCalendar>({
        url: '/subscriptions/charge-calendar',
        params: { months: CALENDAR_MONTHS },
        signal,
      }),
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
    void apiClient
      .get(`/workspaces/${currentWorkspace.id}`)
      .then(res => {
        setWorkspaceMembers(res.data?.members ?? []);
      })
      .catch(() => setWorkspaceMembers([]));
  }, [currentWorkspace?.id]);

  const openCreate = useCallback(() => {
    setEditingSubscription(null);
    setFormData(makeEmptyForm(workspaceCurrency));
    setDialogOpen(true);
  }, [workspaceCurrency]);

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
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingSubscription(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!(formData.vendorName && formData.amount)) return;

    const payload = {
      vendorName: formData.vendorName,
      amount: Number(formData.amount),
      frequency: formData.frequency,
      currency: formData.currency || workspaceCurrency,
      categoryId: formData.categoryId || undefined,
      nextChargeDate: formData.nextChargeDate || undefined,
      // The guess is only ever sent after the form showed it as a placeholder.
      vendorDomain: formData.vendorDomain || guessVendorDomain(formData.vendorName) || undefined,
    };
    const editingId = editingSubscription?.id;

    await saveMutation
      .mutateAsync({
        run: () =>
          editingId
            ? apiClient.put(`/subscriptions/${editingId}`, payload)
            : apiClient.post('/subscriptions', payload),
        success: editingId ? text.toastUpdated.value : text.toastCreated.value,
        failure: text.toastSaveFailed.value,
      })
      // Диалог закрывается только после успеха: при ошибке форма остаётся
      // заполненной, как и до миграции.
      .then(() => closeDialog())
      .catch(() => undefined);
  }, [
    formData,
    editingSubscription,
    closeDialog,
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

  const assignOwner = useCallback(
    async (id: string, ownerId: string) => {
      rowMutation.mutate({
        run: () => apiClient.patch(`/subscriptions/${id}/owner`, { ownerId }),
        success: text.toastOwnerAssigned.value,
        failure: text.toastOwnerAssignFailed.value,
      });
    },
    [rowMutation.mutate, text],
  );

  const duplicatesQuery = useQuery({
    queryKey: queryKeys.subscriptionsDuplicates(workspaceId),
    queryFn: ({ signal }) =>
      apiQuery<Array<{ key: string; items: Array<{ id: string }> }>>({
        url: '/subscriptions/duplicates',
        signal,
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

  const recordDecision = useCallback(
    async (
      id: string,
      decision: 'keep' | 'review' | 'cancelled' | 'price_reduced',
      values: { note?: string; reviewAt?: string; realizedAnnualSavings?: number } = {},
    ) => {
      rowMutation.mutate({
        run: () => apiClient.post(`/subscriptions/${id}/decisions`, { decision, ...values }),
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
    assignOwner,
    recordDecision,
    recordUsage,
    createSinkingFund,
    duplicateIds,
  };
}
