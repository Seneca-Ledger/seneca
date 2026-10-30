'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { FileUp, Trash2 } from '@/app/components/icons';
import { EmptyState } from '@/app/components/ui/EmptyState';
import { ModalShell } from '@/app/components/ui/modal-shell';
import { PrivateAmount } from '@/app/components/ui/private-amount';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { BalanceHistoryPoint } from '@/app/lib/contracts';
import { formatMoney } from '@/app/lib/format-money';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { formatStoredDate } from '@/app/lib/user-format-store';

type BalanceHistoryDialogProps = {
  accountId: string | null;
  accountName: string;
  isOpen: boolean;
  onClose: () => void;
};

function HistoryRow({
  point,
  removeLabel,
  isRemoving,
  onRemove,
}: {
  point: BalanceHistoryPoint;
  removeLabel: string;
  /** Null when the viewer may only read the history. */
  isRemoving: boolean | null;
  onRemove: (date: string) => void;
}): React.JSX.Element {
  const { locale } = useLocale();
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
        {formatStoredDate(point.date)}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          flexGrow: 1,
          textAlign: 'right',
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {/* A history row carries the currency it was entered in, which need not be the sheet's. */}
        <PrivateAmount>{formatMoney(point.amount, point.currency, locale)}</PrivateAmount>
      </Typography>
      {isRemoving !== null && (
        <IconButton
          size="small"
          aria-label={`${removeLabel} ${point.date}`}
          disabled={isRemoving}
          onClick={() => onRemove(point.date)}
        >
          <Trash2 size={16} />
        </IconButton>
      )}
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
}: BalanceHistoryDialogProps): React.JSX.Element {
  const t = useIntlayer('reportsPage');
  const text = t.labels as Record<string, { value?: string } | undefined>;
  const labels = {
    title: text.snapshotHistoryTitle?.value ?? '',
    hint: text.snapshotHistoryHint?.value ?? '',
    empty: text.snapshotHistoryEmpty?.value ?? '',
    import: text.snapshotHistoryImport?.value ?? '',
    remove: text.snapshotHistoryRemove?.value ?? '',
  };
  // Reading the history is a report; changing it changes what the workspace owns.
  const canEdit = usePermissions().hasPermission('wallet.edit');
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const history = useQuery({
    queryKey: queryKeys.balanceAccountHistory({ workspaceId, accountId: accountId ?? '' }),
    enabled: isOpen && Boolean(accountId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: `/reports/balance/accounts/${accountId}/history`,
        signal,
        contract: 'BalanceAccountHistory',
      }),
  });

  // The sheet, the chart and this list all read the same snapshots.
  const refreshEverything = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['balance-sheet', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['net-worth', workspaceId] });
  };

  const removePoint = useMutation({
    mutationFn: async (date: string) => {
      await apiClient.delete(`/reports/balance/accounts/${accountId}/history/${date}`);
    },
    onSuccess: refreshEverything,
    onError: (err: unknown) => setError(getApiErrorMessage(err, labels.title)),
  });

  const importFile = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      await apiClient.post(`/reports/balance/accounts/${accountId}/history`, form);
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
        <Typography variant="body2" sx={{ mb: 2, color: 'var(--money-down)' }}>
          {error}
        </Typography>
      )}

      {history.isPending ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Skeleton variant="text" height={28} />
          <Skeleton variant="text" height={28} />
          <Skeleton variant="text" height={28} />
        </Box>
      ) : points.length === 0 ? (
        <EmptyState illustration="reports" description={labels.empty} compact />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {points.map(point => (
            <HistoryRow
              key={point.date}
              point={point}
              removeLabel={labels.remove}
              isRemoving={canEdit ? removePoint.isPending : null}
              onRemove={date => {
                setError(null);
                removePoint.mutate(date);
              }}
            />
          ))}
        </Box>
      )}

      {canEdit && (
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
      )}
    </ModalShell>
  );
}
