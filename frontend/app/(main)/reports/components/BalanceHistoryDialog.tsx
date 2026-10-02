'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { FileUp, Trash2 } from '@/app/components/icons';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { Spinner } from '@/app/components/ui/spinner';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import { queryKeys } from '@/app/lib/query-keys';

export type BalanceHistoryPoint = {
  date: string;
  amount: number;
  currency: string;
};

type BalanceHistoryDialogProps = {
  accountId: string | null;
  accountName: string;
  isOpen: boolean;
  onClose: () => void;
  formatCurrency: (value: number, currency?: string) => string;
  labels: {
    title: string;
    hint: string;
    empty: string;
    import: string;
    remove: string;
  };
};

function HistoryRow({
  point,
  formatCurrency,
  removeLabel,
  isRemoving,
  onRemove,
}: {
  point: BalanceHistoryPoint;
  formatCurrency: (value: number, currency?: string) => string;
  removeLabel: string;
  isRemoving: boolean;
  onRemove: (date: string) => void;
}): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        py: 1,
        borderBottom: '1px solid',
        borderColor: 'divider',
        '&:last-of-type': { borderBottom: 'none' },
      }}
    >
      <Typography variant="body2" sx={{ flex: '0 0 110px' }}>
        {point.date}
      </Typography>
      <Typography variant="body2" sx={{ flexGrow: 1, textAlign: 'right', fontWeight: 600 }}>
        {formatCurrency(point.amount, point.currency)}
      </Typography>
      <IconButton
        size="small"
        aria-label={`${removeLabel} ${point.date}`}
        disabled={isRemoving}
        onClick={() => onRemove(point.date)}
      >
        <Trash2 size={16} />
      </IconButton>
    </Box>
  );
}

/**
 * What was entered against one balance line, day by day.
 *
 * The chart holds each value until the next one, so a single wrong day — a
 * sync that reported zero, an account entered twice — bends the curve for as
 * long as it stands. This is where that day is found and taken out, and where
 * a history kept in another app is brought in.
 */
export function BalanceHistoryDialog({
  accountId,
  accountName,
  isOpen,
  onClose,
  formatCurrency,
  labels,
}: BalanceHistoryDialogProps): React.JSX.Element {
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const history = useQuery({
    queryKey: queryKeys.balanceAccountHistory({ workspaceId, accountId: accountId ?? '' }),
    enabled: isOpen && Boolean(accountId),
    queryFn: async ({ signal }) => {
      const response = await apiClient.get(`/reports/balance/accounts/${accountId}/history`, {
        signal,
      });
      return (response.data?.data ?? response.data) as BalanceHistoryPoint[];
    },
  });

  // The sheet, the chart and this list all read the same snapshots.
  const refreshEverything = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['balance-sheet', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['net-worth', workspaceId] });
  };

  const removePoint = useMutation({
    mutationFn: (date: string) =>
      apiClient.delete(`/reports/balance/accounts/${accountId}/history/${date}`),
    onSuccess: refreshEverything,
    onError: (err: unknown) => setError(getApiErrorMessage(err, labels.title)),
  });

  const importFile = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return apiClient.post(`/reports/balance/accounts/${accountId}/history`, form);
    },
    onSuccess: refreshEverything,
    onError: (err: unknown) => setError(getApiErrorMessage(err, labels.title)),
  });

  const points = history.data ?? [];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title={`${labels.title} — ${accountName}`}
      size="sm"
    >
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        {labels.hint}
      </Typography>

      {error && (
        <Typography variant="body2" color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}

      {history.isPending ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Spinner />
        </Box>
      ) : points.length === 0 ? (
        <EmptyState illustration="reports" description={labels.empty} compact />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {points.map(point => (
            <HistoryRow
              key={point.date}
              point={point}
              formatCurrency={formatCurrency}
              removeLabel={labels.remove}
              isRemoving={removePoint.isPending}
              onRemove={date => {
                setError(null);
                removePoint.mutate(date);
              }}
            />
          ))}
        </Box>
      )}

      <Box sx={{ mt: 2 }}>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          hidden
          onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) {
              setError(null);
              importFile.mutate(file);
            }
          }}
        />
        <Button
          variant="outlined"
          size="small"
          startIcon={<FileUp size={16} />}
          disabled={importFile.isPending || !accountId}
          onClick={() => fileInput.current?.click()}
        >
          {labels.import}
        </Button>
      </Box>
    </ModalShell>
  );
}
