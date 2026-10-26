'use client';

import { Box, Chip, Stack, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import type React from 'react';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Button } from '@/app/components/ui/button';
import { useWorkspaceId } from '@/app/hooks/useWorkspaceId';
import { useIntlayer, useLocale } from '@/app/i18n';
import { getApiErrorMessage } from '@/app/lib/api-error';
import type { PeppolTransmission } from '@/app/lib/contracts';
import { type PeppolDocumentKind, peppolApi, peppolTransmissionsUrl } from '@/app/lib/peppol-api';
import { apiQueryDecoded } from '@/app/lib/query-fn-schema';
import { queryKeys } from '@/app/lib/query-keys';
import { XRechnungMissingAlert } from './XRechnungFields';

/** What the backend lists as missing on a PEPPOL_DOCUMENT_INCOMPLETE answer. */
function missingOf(error: unknown): string[] | null {
  if (!isAxiosError(error)) {
    return null;
  }
  const body = error.response?.data as
    | { error?: { code?: string; details?: { missing?: unknown } } }
    | undefined;
  const missing = body?.error?.details?.missing;
  return body?.error?.code === 'PEPPOL_DOCUMENT_INCOMPLETE' && Array.isArray(missing)
    ? missing.map(String)
    : null;
}

/**
 * Sending an issued invoice or credit note over Peppol, and what became of
 * each send. The format is the backend's choice (what the recipient
 * registered); a document can be sent again only after a failed attempt.
 */
export function PeppolPanel({
  kind,
  documentId,
  compact = false,
}: {
  kind: PeppolDocumentKind;
  documentId: string;
  /** A credit note's row: only the button and the latest status. */
  compact?: boolean;
}): React.ReactElement | null {
  const t = useIntlayer('peppol');
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const [missing, setMissing] = useState<string[] | null>(null);
  const queryKey = queryKeys.peppolTransmissions({ workspaceId, kind, documentId });

  // Shown only to a workspace that connected an access point; the others
  // find Peppol under Integrations.
  const connection = useQuery({
    queryKey: queryKeys.peppolConnection(workspaceId),
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: '/integrations/peppol/status',
        signal,
        contract: 'IntegrationConnection',
      }),
    enabled: Boolean(workspaceId),
  });
  const connected = Boolean(connection.data?.connected);
  const log = useQuery({
    queryKey,
    queryFn: ({ signal }) =>
      apiQueryDecoded({
        url: peppolTransmissionsUrl(kind, documentId),
        signal,
        contract: 'PeppolTransmissionList',
      }),
    enabled: Boolean(workspaceId) && connected,
  });

  const send = useMutation({
    mutationFn: () => peppolApi.send(kind, documentId),
    onSuccess: () => {
      setMissing(null);
      toast.success(t.sent.value);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: unknown) => {
      const gaps = missingOf(error);
      setMissing(gaps);
      if (!gaps) {
        toast.error(getApiErrorMessage(error, t.sendFailed.value));
      }
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const rows = log.data ?? [];
  const live = rows.some(row => row.status !== 'failed');
  const statusLabel: Record<PeppolTransmission['status'], string> = {
    pending: t.statusPending.value,
    delivered: t.statusDelivered.value,
    failed: t.statusFailed.value,
  };
  const formatLabel: Record<PeppolTransmission['format'], string> = {
    peppol_bis: 'Peppol BIS 3.0',
    xrechnung_cii: 'XRechnung (CII)',
  };
  const color = (status: PeppolTransmission['status']) =>
    status === 'delivered' ? 'success' : status === 'failed' ? 'error' : 'default';
  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });

  const button = (
    <Button
      variant="outline"
      disabled={live || send.isPending}
      onClick={() => send.mutate()}
      data-testid={`peppol-send-${kind}`}
    >
      {send.isPending ? t.sending.value : t.send.value}
    </Button>
  );

  if (!connected) {
    return null;
  }

  if (compact) {
    const latest = rows[0];
    return (
      <>
        {button}
        {latest ? (
          <Chip size="small" color={color(latest.status)} label={statusLabel[latest.status]} />
        ) : null}
        {missing ? (
          <XRechnungMissingAlert
            missing={missing}
            onClose={() => setMissing(null)}
            title={t.missingTitle.value}
          />
        ) : null}
      </>
    );
  }

  return (
    <Box data-testid="peppol-panel">
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          mb: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{t.title.value}</Typography>
        {button}
      </Stack>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1, maxWidth: 640 }}>
        {t.hint.value}
      </Typography>
      {missing ? (
        <XRechnungMissingAlert
          missing={missing}
          onClose={() => setMissing(null)}
          title={t.missingTitle.value}
        />
      ) : null}
      {rows.length > 0 ? (
        <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {rows.map(row => (
            <Box
              component="li"
              key={row.id}
              sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, fontSize: 13 }}
            >
              <Chip size="small" color={color(row.status)} label={statusLabel[row.status]} />
              <span>{when(row.createdAt)}</span>
              <span>→ {row.recipient}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{formatLabel[row.format]}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  void peppolApi
                    .downloadSent(row.id, `peppol-${row.id.slice(0, 8)}.xml`)
                    .catch((error: unknown) =>
                      toast.error(getApiErrorMessage(error, t.sendFailed.value)),
                    )
                }
              >
                {t.downloadXml.value}
              </Button>
              {row.failure ? (
                <Typography sx={{ fontSize: 12, color: 'error.main', width: '100%' }}>
                  {row.failure}
                </Typography>
              ) : null}
            </Box>
          ))}
        </Stack>
      ) : null}
    </Box>
  );
}
