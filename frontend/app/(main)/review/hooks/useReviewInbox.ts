'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import type { PayeeChoice } from '@/app/components/payees/types';
import { useOfferPayeeQueue } from '@/app/components/payees/useOfferPayeeQueue';
import { useSetTransactionPayee } from '@/app/components/payees/usePayees';
import { type Reviewer, useDefaultReviewer } from '@/app/components/review/useReviewer';
import { useHouseholdMembers } from '@/app/components/transactions/hooks/useWorkspaceMembers';
import type { Category } from '@/app/components/transactions/types';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient, { receiptsApi } from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { apiQueryDecoded, type ContractInput, checkContract } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { getCategoryDisplayName } from '@/app/lib/statement-categories';
import {
  cursorAfterRemoval,
  isReviewInboxKind,
  moveCursor,
  type ReviewInboxItem,
  type ReviewInboxKind,
  type ReviewInboxPage,
  targetIds,
  toggleSelection,
} from '../lib/review-inbox-model';

const PAGE_SIZE = 100;
const CATEGORIES_STALE_TIME = 5 * 60 * 1000;

export interface UseReviewInboxResult {
  kind: ReviewInboxKind;
  setKind: (kind: ReviewInboxKind) => void;
  /** Whose backlog the queue is showing; absent when the workspace has one member. */
  reviewer: Reviewer;
  setReviewer: (reviewer: Reviewer) => void;
  /** False for a workspace of one: nobody to filter against. */
  canFilterByReviewer: boolean;
  from: string;
  to: string;
  setFrom: (value: string) => void;
  setTo: (value: string) => void;
  page: ReviewInboxPage | undefined;
  items: ReviewInboxItem[];
  categories: Category[];
  isPending: boolean;
  error: string | null;
  selected: Set<string>;
  toggle: (id: string) => void;
  selectIds: (ids: string[]) => void;
  clearSelection: () => void;
  cursor: number;
  setCursor: (index: number) => void;
  move: (delta: number) => void;
  busy: boolean;
  /** Approves the selection (or the cursor row) with a category, or as is. */
  approve: (categoryId?: string, ids?: string[]) => Promise<void>;
  resolveDuplicate: (id: string, decision: 'keep' | 'confirm') => Promise<void>;
  approveReceipt: (id: string) => Promise<void>;
  decideSubscription: (id: string, decision: 'confirm' | 'dismiss') => Promise<void>;
  /** Moves a row to another payee; the next import of its descriptor follows. */
  changePayee: (id: string, choice: PayeeChoice, name: string) => Promise<void>;
}

function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(params[key] ?? ''));
}

export function useReviewInbox(): UseReviewInboxResult {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useIntlayer('reviewInbox');
  const tPayees = useIntlayer('payees');
  const { locale } = useLocale();

  const kindParam = searchParams.get('kind');
  const kind: ReviewInboxKind = isReviewInboxKind(kindParam) ? kindParam : 'transaction';
  const members = useHouseholdMembers();
  const defaultReviewer = useDefaultReviewer();
  const reviewerParam = searchParams.get('reviewer');
  const reviewer: Reviewer =
    reviewerParam === 'me' || reviewerParam === 'anyone' ? reviewerParam : defaultReviewer;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [cursor, setCursor] = useState(-1);

  const setKind = useCallback(
    (next: ReviewInboxKind) => {
      setSelected(new Set());
      setCursor(-1);
      router.replace(next === 'transaction' ? '/review' : `/review?kind=${next}`);
    },
    [router],
  );

  const setReviewer = useCallback(
    (next: Reviewer) => {
      setSelected(new Set());
      setCursor(-1);
      const query = new URLSearchParams(searchParams.toString());
      query.set('reviewer', next);
      if (kind === 'transaction') query.delete('kind');
      router.replace(`/review?${query.toString()}`);
    },
    [kind, router, searchParams],
  );

  const params = useMemo(
    () => ({
      kind,
      limit: PAGE_SIZE,
      reviewer,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    }),
    [kind, reviewer, from, to],
  );

  const pageQuery = useQuery({
    queryKey: queryKeys.reviewInbox({ workspaceId, params }),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/review-inbox', params, signal, contract: 'ReviewInboxPage' }),
    enabled: Boolean(workspaceId),
  });

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({ url: '/categories', signal, contract: 'CategoryList' }),
    staleTime: CATEGORIES_STALE_TIME,
    enabled: Boolean(workspaceId),
  });

  const items = pageQuery.data?.items ?? [];

  const invalidate = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['review-inbox'] }),
      queryClient.invalidateQueries({ queryKey: ['transactions'] }),
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
    ]);
  }, [queryClient]);

  const failedText = t.toastFailed.value;
  const doneText = t.toastDone.value;
  const approvedText = t.toastApproved.value;

  /** Removes the resolved rows from the selection and keeps the cursor on a row. */
  const afterResolved = useCallback(
    (ids: string[]) => {
      setSelected(previous => {
        const next = new Set(previous);
        for (const id of ids) next.delete(id);
        return next;
      });
      setCursor(current => cursorAfterRemoval(current, Math.max(0, items.length - ids.length)));
    },
    [items.length],
  );

  const rememberedText = tPayees.remembered.value;
  const categories = categoriesQuery.data;
  const offerPayeeQueue = useOfferPayeeQueue();

  /** Offers the category to the payee's other waiting rows, when one payee was approved. */
  const offerToRestOfPayee = useCallback(
    (approvedIds: string[], categoryId: string) => {
      const payees = new Map<string, string>();
      for (const item of items) {
        if (item.kind === 'transaction' && item.payee && approvedIds.includes(item.id)) {
          payees.set(item.payee.id, item.payee.name);
        }
      }
      if (payees.size !== 1) return;
      const [[id, name]] = [...payees];
      const picked = categories?.find(entry => entry.id === categoryId);
      void offerPayeeQueue(
        { id, name },
        categoryId,
        picked ? getCategoryDisplayName(picked, locale) : '',
        approvedIds,
      );
    },
    [items, categories, locale, offerPayeeQueue],
  );

  const approveMutation = useMutation({
    mutationFn: async ({ ids, categoryId }: { ids: string[]; categoryId?: string }) => {
      const response = await apiClient.post('/review-inbox/transactions/approve', {
        ids,
        ...(categoryId ? { categoryId } : {}),
      } satisfies ContractInput<'ApproveTransactionsBody'>);
      return checkContract('ReviewApproved', response.data, '/review-inbox/transactions/approve');
    },
    onSuccess: async (result, variables) => {
      toast.success(fill(approvedText, { count: result.approved }));
      afterResolved(variables.ids);
      if (variables.categoryId) {
        offerToRestOfPayee(variables.ids, variables.categoryId);
      }
      await invalidate();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, failedText));
    },
  });

  const simpleMutation = useMutation({
    mutationFn: ({ id, run }: { id: string; run: () => Promise<unknown> }) => run().then(() => id),
    onSuccess: async (id: string) => {
      toast.success(doneText);
      afterResolved([id]);
      await invalidate();
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, failedText));
    },
  });

  const approve = useCallback(
    async (categoryId?: string, ids?: string[]) => {
      const target = ids ?? targetIds(selected, items, cursor);
      if (target.length === 0) return;
      await approveMutation.mutateAsync({ ids: target, categoryId }).catch(() => undefined);
    },
    [approveMutation, selected, items, cursor],
  );

  const resolveDuplicate = useCallback(
    async (id: string, decision: 'keep' | 'confirm') => {
      await simpleMutation
        .mutateAsync({
          id,
          run: () =>
            apiClient.post(`/review-inbox/duplicates/${id}/resolve`, {
              decision,
            } satisfies ContractInput<'ResolveDuplicateBody'>),
        })
        .catch(() => undefined);
    },
    [simpleMutation],
  );

  const approveReceipt = useCallback(
    async (id: string) => {
      await simpleMutation
        .mutateAsync({ id, run: () => receiptsApi.approveReceipt(id) })
        .catch(() => undefined);
    },
    [simpleMutation],
  );

  const decideSubscription = useCallback(
    async (id: string, decision: 'confirm' | 'dismiss') => {
      await simpleMutation
        .mutateAsync({ id, run: () => apiClient.post(`/subscriptions/${id}/${decision}`) })
        .catch(() => undefined);
    },
    [simpleMutation],
  );

  const setPayeeMutation = useSetTransactionPayee();
  const changePayee = useCallback(
    async (id: string, choice: PayeeChoice, name: string) => {
      const raw = items.find(item => item.id === id);
      await setPayeeMutation
        .mutateAsync({ transactionId: id, choice })
        .then(() =>
          toast.success(
            fill(rememberedText, {
              raw: raw && 'counterpartyName' in raw ? raw.counterpartyName : '',
              payee: name,
            }),
          ),
        )
        .catch((error: unknown) => toast.error(getApiErrorMessage(error, failedText)));
    },
    [items, setPayeeMutation, rememberedText, failedText],
  );

  const toggle = useCallback(
    (id: string) => setSelected(previous => toggleSelection(previous, id)),
    [],
  );
  const selectIds = useCallback((ids: string[]) => setSelected(new Set(ids)), []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);
  const move = useCallback(
    (delta: number) => setCursor(current => moveCursor(current, delta, items.length)),
    [items.length],
  );

  return {
    kind,
    setKind,
    reviewer,
    setReviewer,
    canFilterByReviewer: members.length > 0,
    from,
    to,
    setFrom,
    setTo,
    page: pageQuery.data,
    items,
    categories: categoriesQuery.data ?? [],
    isPending: pageQuery.isPending,
    error: pageQuery.isError ? getApiErrorMessage(pageQuery.error, t.loadError.value) : null,
    selected,
    toggle,
    selectIds,
    clearSelection,
    cursor,
    setCursor,
    move,
    busy: approveMutation.isPending || simpleMutation.isPending || setPayeeMutation.isPending,
    approve,
    resolveDuplicate,
    approveReceipt,
    decideSubscription,
    changePayee,
  };
}
