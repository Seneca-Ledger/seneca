'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import type { ContractInput } from '@/app/lib/query-fn-schema';
import { mapApiRecordToTransaction, type TransactionApiRecord } from '../helpers/transactionMapper';
import type { Transaction } from '../types';

export type LinkMode = 'transfer' | 'reimbursement';

export interface UseTransferLinkResult {
  /** Counterparts the user may link by hand; null until `loadCandidates` ran. */
  candidates: Transaction[] | null;
  /** What the open picker is for. */
  mode: LinkMode;
  loadCandidates: (transactionId: string, mode?: LinkMode) => Promise<void>;
  clearCandidates: () => void;
  link: (transactionId: string, otherId: string) => Promise<void>;
  unlink: (transactionId: string) => Promise<void>;
  linkReimbursement: (transactionId: string, expenseId: string) => Promise<void>;
  unlinkReimbursement: (transactionId: string) => Promise<void>;
  loading: boolean;
  saving: boolean;
}

function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response
    ?.data?.message;
  if (Array.isArray(message)) {
    return message[0] ?? fallback;
  }
  return message ?? fallback;
}

export function useTransferLink(onDone: () => void | Promise<void>): UseTransferLinkResult {
  const [candidates, setCandidates] = useState<Transaction[] | null>(null);
  const [mode, setMode] = useState<LinkMode>('transfer');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const t = useIntlayer('transactionsDrawer');
  const linkedText = t.transfer.toasts.linked.value;
  const unlinkedText = t.transfer.toasts.unlinked.value;
  const failedText = t.transfer.toasts.failed.value;
  const reimbursedText = t.reimbursement.toasts.linked.value;
  const unreimbursedText = t.reimbursement.toasts.unlinked.value;

  // Promise chains rather than try/finally: React Compiler skips hooks that
  // contain a `finally` clause.
  const loadCandidates = useCallback(
    async (transactionId: string, nextMode: LinkMode = 'transfer') => {
      setLoading(true);
      setMode(nextMode);
      const path =
        nextMode === 'reimbursement' ? 'reimbursement-candidates' : 'transfer-candidates';
      await apiClient
        .get<{ data: TransactionApiRecord[] }>(`/transactions/${transactionId}/${path}`)
        .then(response => {
          setCandidates((response.data?.data ?? []).map(mapApiRecordToTransaction));
        })
        .catch((error: unknown) => {
          toast.error(errorMessage(error, failedText));
        });
      setLoading(false);
    },
    [failedText],
  );

  const clearCandidates = useCallback(() => setCandidates(null), []);

  const link = useCallback(
    async (transactionId: string, otherId: string) => {
      setSaving(true);
      await apiClient
        .post(`/transactions/${transactionId}/link-transfer`, {
          otherId,
        } satisfies ContractInput<'LinkTransferBody'>)
        .then(async () => {
          toast.success(linkedText);
          setCandidates(null);
          await onDone();
        })
        .catch((error: unknown) => {
          toast.error(errorMessage(error, failedText));
        });
      setSaving(false);
    },
    [onDone, linkedText, failedText],
  );

  const unlink = useCallback(
    async (transactionId: string) => {
      setSaving(true);
      await apiClient
        .post(`/transactions/${transactionId}/unlink-transfer`)
        .then(async () => {
          toast.success(unlinkedText);
          await onDone();
        })
        .catch((error: unknown) => {
          toast.error(errorMessage(error, failedText));
        });
      setSaving(false);
    },
    [onDone, unlinkedText, failedText],
  );

  const linkReimbursement = useCallback(
    async (transactionId: string, expenseId: string) => {
      setSaving(true);
      await apiClient
        .post(`/transactions/${transactionId}/link-reimbursement`, {
          expenseId,
        } satisfies ContractInput<'LinkReimbursementBody'>)
        .then(async () => {
          toast.success(reimbursedText);
          setCandidates(null);
          await onDone();
        })
        .catch((error: unknown) => {
          toast.error(errorMessage(error, failedText));
        });
      setSaving(false);
    },
    [onDone, reimbursedText, failedText],
  );

  const unlinkReimbursement = useCallback(
    async (transactionId: string) => {
      setSaving(true);
      await apiClient
        .post(`/transactions/${transactionId}/unlink-reimbursement`)
        .then(async () => {
          toast.success(unreimbursedText);
          await onDone();
        })
        .catch((error: unknown) => {
          toast.error(errorMessage(error, failedText));
        });
      setSaving(false);
    },
    [onDone, unreimbursedText, failedText],
  );

  return {
    candidates,
    mode,
    loadCandidates,
    clearCandidates,
    link,
    unlink,
    linkReimbursement,
    unlinkReimbursement,
    loading,
    saving,
  };
}
