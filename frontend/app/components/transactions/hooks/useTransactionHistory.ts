'use client';

import { useCallback, useEffect, useState } from 'react';

import type { AuditEvent } from '@/lib/api/audit';
import { fetchEntityHistory } from '@/lib/api/audit';

export interface UseTransactionHistoryResult {
  historyEvents: AuditEvent[];
  historyLoading: boolean;
  historyDrawerOpen: boolean;
  selectedHistoryEvent: AuditEvent | null;
  openEventDrawer: (event: AuditEvent) => void;
  closeEventDrawer: () => void;
}

export function useTransactionHistory(
  open: boolean,
  transactionId: string | undefined,
): UseTransactionHistoryResult {
  const [historyEvents, setHistoryEvents] = useState<AuditEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDrawerOpen, setHistoryDrawerOpen] = useState(false);
  const [selectedHistoryEvent, setSelectedHistoryEvent] = useState<AuditEvent | null>(null);

  useEffect(() => {
    if (!(open && transactionId)) return;
    let cancelled = false;
    setHistoryLoading(true);
    fetchEntityHistory('transaction', transactionId)
      .then(events => {
        if (cancelled) return;
        setHistoryEvents(events || []);
      })
      .catch(error => {
        if (cancelled) return;
        console.error('Failed to load history:', error);
        setHistoryEvents([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, transactionId]);

  const openEventDrawer = useCallback((event: AuditEvent) => {
    setSelectedHistoryEvent(event);
    setHistoryDrawerOpen(true);
  }, []);

  const closeEventDrawer = useCallback(() => {
    setHistoryDrawerOpen(false);
  }, []);

  return {
    historyEvents,
    historyLoading,
    historyDrawerOpen,
    selectedHistoryEvent,
    openEventDrawer,
    closeEventDrawer,
  };
}
