'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useWorkspace } from '@/app/contexts/WorkspaceContext';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';

export interface BudgetItem {
  id: string;
  name: string;
  categoryId: string;
  category?: { id: string; name: string; color?: string | null; icon?: string | null };
  limitAmount: number;
  /** Budget limit in the workspace currency (API may return it as a decimal string). */
  limitAmountWorkspace?: number;
  /** User-entered spent amount for a budget cycle (API may return it as a decimal string). */
  manualSpentAmount?: number;
  spentAmount: number;
  percentUsed: number;
  /** What the period has to spend once rollover is settled; equals the limit without rollover. */
  availableAmount?: number;
  /** Positive = leftover carried in, negative = overspend carried in. */
  carriedAmount?: number;
  rolloverMode?: BudgetRolloverMode;
  currency: string;
  workspaceCurrency?: string;
  periodType: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  /** The goal this budget serves; null when it stands on its own. */
  goalId?: string | null;
  /** The window the budget applies in; both null means it runs forever. */
  startsOn?: string | null;
  endsOn?: string | null;
  /** Whether today falls inside that window. */
  isActive?: boolean;
  /** Spending in currencies with no rate to the budget's: left out of spentAmount. */
  unconvertedSpending?: Array<{ currency: string; amount: number }>;
  /** The category's spending this period before `startsOn`: outside the budget. */
  beforeStartSpending?: Array<{ currency: string; amount: number }>;
  createdAt: string;
}

export type BudgetRolloverMode = 'none' | 'carry' | 'refill';

export interface BudgetFormData {
  name: string;
  categoryId: string;
  limitAmount: number;
  manualSpentAmount: number;
  periodType: 'weekly' | 'monthly' | 'quarterly' | 'annual';
  rolloverMode: BudgetRolloverMode;
  currency: string;
  /** Empty string means "no goal"; the API takes null for that. */
  goalId: string;
  /** Empty string means "no boundary"; the API takes null for that. */
  startsOn: string;
  endsOn: string;
}

export type BudgetDrawerIntent = 'create' | 'edit' | 'spending';

const DEFAULT_CURRENCY = 'USD';

const makeEmptyForm = (currency: string): BudgetFormData => ({
  name: '',
  categoryId: '',
  limitAmount: 0,
  manualSpentAmount: 0,
  periodType: 'monthly',
  rolloverMode: 'none',
  currency,
  goalId: '',
  startsOn: '',
  endsOn: '',
});

/** Coerces API decimal strings/numbers to a non-negative finite number. */
export function toNonNegativeNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed < 0 ? 0 : parsed;
}

/** A budget as `GET /budgets` sends it: `limitAmount` is a decimal string. */
type BudgetRow = Omit<BudgetItem, 'limitAmount'> & { limitAmount: number | string };

/**
 * Normalizes budget API decimal fields into usable numbers before form editing
 * and summaries. Without it the edit form kept `limitAmount` as "100.00", and
 * saving a budget without retyping the amount was rejected with a 400.
 */
export function normalizeBudgetItem(budget: BudgetRow): BudgetItem {
  return {
    ...budget,
    limitAmount: toNonNegativeNumber(budget.limitAmount),
    limitAmountWorkspace:
      budget.limitAmountWorkspace === undefined
        ? undefined
        : toNonNegativeNumber(budget.limitAmountWorkspace),
    manualSpentAmount:
      budget.manualSpentAmount === undefined
        ? undefined
        : toNonNegativeNumber(budget.manualSpentAmount),
    spentAmount: toNonNegativeNumber(budget.spentAmount),
    percentUsed: toNonNegativeNumber(budget.percentUsed),
  };
}

/**
 * `GET /budgets` as the app holds it. Every reader of `queryKeys.budgets` must
 * use this, so the cache never mixes raw rows with normalized ones.
 */
/** `date` (`YYYY-MM-DD`) measures spending for the period that day falls in; today by default. */
export async function fetchBudgets(signal?: AbortSignal, date?: string): Promise<BudgetItem[]> {
  const rows = await apiQueryDecoded({
    url: '/budgets',
    params: date ? { date } : undefined,
    signal,
    contract: 'BudgetList',
  });
  return rows.map(normalizeBudgetItem);
}

/**
 * Builds the update payload for a budget. Spending-only updates must not resend
 * the budget limit, so only the manual spent amount is included for that intent.
 */
export function buildBudgetUpdatePayload(
  formData: BudgetFormData,
  intent: BudgetDrawerIntent,
): Partial<BudgetFormData> {
  if (intent === 'spending') {
    return { manualSpentAmount: formData.manualSpentAmount };
  }
  return {
    name: formData.name,
    categoryId: formData.categoryId,
    limitAmount: formData.limitAmount,
    manualSpentAmount: formData.manualSpentAmount,
    periodType: formData.periodType,
    rolloverMode: formData.rolloverMode,
    currency: formData.currency,
    goalId: formData.goalId,
    startsOn: formData.startsOn,
    endsOn: formData.endsOn,
  };
}

export function useBudgetsPage() {
  const text = useIntlayer('budgetsPage');
  const { currentWorkspace } = useWorkspace();
  const workspaceCurrency = currentWorkspace?.currency ?? DEFAULT_CURRENCY;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [formData, setFormData] = useState<BudgetFormData>(() => makeEmptyForm(workspaceCurrency));

  // Workspace-scoped: the request itself does not mention the workspace (the
  // server scopes by header), so the key carries it explicitly.
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = useQuery({
    queryKey: queryKeys.budgets(workspaceId),
    queryFn: ({ signal }) => fetchBudgets(signal),
  });

  const invalidate = useCallback((): Promise<void> => {
    return queryClient.invalidateQueries({ queryKey: queryKeys.budgets(workspaceId) });
  }, [queryClient, workspaceId]);

  /** `categoryId` preseeds the form for the "this category has no budget"
   * insight, which links here precisely because nothing exists to open yet. */
  const openCreate = useCallback(
    (categoryId?: string) => {
      setEditingBudget(null);
      setFormData({ ...makeEmptyForm(workspaceCurrency), categoryId: categoryId ?? '' });
      setDialogOpen(true);
    },
    [workspaceCurrency],
  );

  // `?newBudgetCategory=<id>` comes from the "top category has no budget"
  // insight. Stripped once honoured, the same way the statements list handles
  // `openExpenseDrawer` — left in place it would reopen the drawer on close.
  // `?newBudgetGoal=<id>` comes from a goal with no budget attached yet.
  useEffect(() => {
    const categoryId = searchParams.get('newBudgetCategory');
    const goalId = searchParams.get('newBudgetGoal');
    if (!(categoryId || goalId)) {
      return;
    }
    openCreate(categoryId ?? undefined);
    if (goalId) {
      setFormData(prev => ({ ...prev, goalId }));
    }
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('newBudgetCategory');
    nextParams.delete('newBudgetGoal');
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }, [searchParams, openCreate, router, pathname]);

  const openEdit = useCallback((budget: BudgetItem) => {
    setEditingBudget(budget);
    setFormData({
      name: budget.name,
      categoryId: budget.categoryId,
      limitAmount: budget.limitAmount,
      manualSpentAmount: budget.manualSpentAmount ?? 0,
      periodType: budget.periodType,
      rolloverMode: budget.rolloverMode ?? 'none',
      currency: budget.currency,
      goalId: budget.goalId ?? '',
      startsOn: budget.startsOn ?? '',
      endsOn: budget.endsOn ?? '',
    });
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingBudget(null);
    setFormData(makeEmptyForm(workspaceCurrency));
  }, [workspaceCurrency]);

  const saveMutation = useMutation({
    mutationFn: (
      variables:
        | { id: string; body: ContractInput<'UpdateBudgetBody'> }
        | { id: null; body: ContractInput<'CreateBudgetBody'> },
    ): Promise<unknown> =>
      variables.id !== null
        ? apiClient.put(`/budgets/${variables.id}`, variables.body)
        : apiClient.post('/budgets', variables.body),
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/budgets/${id}`);
    },
    onSuccess: () => toast.success(text.toastDeleted.value),
    onError: () => toast.error(text.toastDeleteFailed.value),
    onSettled: invalidate,
  });

  const handleSave = useCallback(async () => {
    const editingId = editingBudget?.id ?? null;
    const variables = editingId
      ? {
          id: editingId,
          body: {
            name: formData.name,
            limitAmount: formData.limitAmount,
            currency: formData.currency,
            rolloverMode: formData.rolloverMode,
            // Explicit null detaches; the API leaves the link alone only when the
            // field is absent, which the form can never mean.
            goalId: formData.goalId || null,
            startsOn: formData.startsOn || null,
            endsOn: formData.endsOn || null,
          },
        }
      : {
          id: null,
          body: {
            name: formData.name,
            categoryId: formData.categoryId,
            limitAmount: formData.limitAmount,
            periodType: formData.periodType,
            rolloverMode: formData.rolloverMode,
            currency: formData.currency,
            goalId: formData.goalId || null,
            startsOn: formData.startsOn || null,
            endsOn: formData.endsOn || null,
          },
        };

    await saveMutation
      .mutateAsync(variables)
      .then(() => {
        toast.success(editingId ? text.toastUpdated.value : text.toastCreated.value);
        closeDialog();
      })
      .catch(err => {
        toast.error(getApiErrorMessage(err, text.toastSaveFailed.value));
      });
  }, [editingBudget, formData, closeDialog, saveMutation.mutateAsync, text]);

  const handleDelete = useCallback(
    async (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation.mutate],
  );

  const refresh = useCallback((): void => {
    void query.refetch();
  }, [query.refetch]);

  return {
    budgets: query.data ?? [],
    isPending: query.isPending,
    isFetching: query.isFetching || deleteMutation.isPending,
    error: query.isError ? text.loadFailed.value : null,
    dialogOpen,
    editingBudget,
    formData,
    saving: saveMutation.isPending,
    setFormData,
    openCreate,
    openEdit,
    closeDialog,
    handleSave,
    handleDelete,
    refresh,
  };
}
