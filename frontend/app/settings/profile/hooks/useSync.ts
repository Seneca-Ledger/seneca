'use client';

import { useCallback, useEffect, useState } from 'react';
import { statementsApi } from '@/app/lib/api';
import { blobOf } from '@/app/lib/blob-of';
import { APP_SLUG } from '@/app/lib/brand';
import { apiQueryDecoded, type ContractInput } from '@/app/lib/query-fn-schema';

export type BankStat = {
  bank: string;
  count: number;
};

export function useSync() {
  const [bankStats, setBankStats] = useState<BankStat[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatsLoading(true);
    apiQueryDecoded({
      url: '/statements',
      params: { limit: 1000 } satisfies ContractInput<'StatementsQuery'>,
      contract: 'StatementList',
    })
      .then(items => {
        const byBank = new Map<string, number>();
        for (const item of items) {
          const key = item.bankName ?? 'other';
          byBank.set(key, (byBank.get(key) ?? 0) + 1);
        }
        const stats: BankStat[] = Array.from(byBank.entries()).map(([bank, count]) => ({
          bank,
          count,
        }));
        setBankStats(stats);
        setTotalCount(items.length);
      })
      .catch(() => {
        // Stats are informational — don't block the UI
      })
      .finally(() => setStatsLoading(false));
  }, []);

  const handleExportZip = useCallback(async () => {
    setDownloading(true);
    setErrorMessage(null);

    await (async () => {
      const res = await statementsApi.exportZip();
      const blob = new Blob([blobOf(res)], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${APP_SLUG}-export.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    })()
      .catch(async () => {
        setErrorMessage('Failed to export files. Please try again.');
      })
      .finally(async () => {
        setDownloading(false);
      });
  }, []);

  return {
    bankStats,
    totalCount,
    statsLoading,
    downloading,
    errorMessage,
    handleExportZip,
  };
}
