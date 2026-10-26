'use client';

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { usePermissions } from '@/app/hooks/usePermissions';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer } from '@/app/i18n';
import apiClient from '@/app/lib/api';
import { getApiErrorMessage } from '@/app/lib/api-error';

/**
 * Offers a household still laid out as a company the chart written in its own
 * words. Nothing forces it; only someone who may change the sheet sees it.
 */
export function PersonalLayoutNotice({
  onError,
}: {
  onError: (message: string) => void;
}): React.JSX.Element | null {
  const t = useIntlayer('reportsPage');
  const labels = t.labels as Record<string, { value?: string } | undefined>;
  const text = (key: string): string => labels[key]?.value ?? '';
  const { hasPermission } = usePermissions();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();

  const apply = useMutation({
    mutationFn: async () => {
      await apiClient.post('/reports/balance/personal-layout');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['balance-sheet', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['net-worth', workspaceId] });
    },
    onError: (err: unknown) => onError(getApiErrorMessage(err, t.errors.loadReport.value)),
  });

  if (!hasPermission('wallet.edit')) return null;

  return (
    <Alert
      severity="info"
      action={
        <Button
          size="small"
          variant="outlined"
          disabled={apply.isPending}
          onClick={() => apply.mutate()}
        >
          {text('personalLayoutApply')}
        </Button>
      }
    >
      {text('personalLayoutHint')}
    </Alert>
  );
}
