'use client';

import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useIntlayer, useLocale } from '@/app/i18n';
import type { IncomeTaxDraft } from '../tax-declaration.types';
import { FilingInfoCard } from './FilingInfoCard';

interface ExportStepProps {
  draft: IncomeTaxDraft;
  downloading: boolean;
  busy: boolean;
  onDownload: (format: 'pdf' | 'xlsx' | 'csv') => void;
  onFinalize: () => void;
  onReopen: () => void;
}

export function ExportStep({
  draft,
  downloading,
  busy,
  onDownload,
  onFinalize,
  onReopen,
}: ExportStepProps): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');
  const { locale } = useLocale();
  const finalized = draft.status === 'finalized';

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
      <Typography sx={{ fontSize: 14, color: 'text.secondary' }}>{t.exportIntro}</Typography>

      {draft.pack.filingChannel ? (
        <Typography sx={{ fontSize: 14 }}>
          <strong>{t.filingChannelLabel}:</strong> {draft.pack.filingChannel}
        </Typography>
      ) : null}

      {draft.filingInfo ? <FilingInfoCard info={draft.filingInfo} /> : null}

      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{
          flexWrap: 'wrap',
        }}
      >
        <Button
          variant="contained"
          disabled={downloading}
          onClick={() => onDownload('pdf')}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {t.downloadPdf}
        </Button>
        <Button
          variant="outlined"
          disabled={downloading}
          onClick={() => onDownload('xlsx')}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {t.downloadXlsx}
        </Button>
        <Button
          variant="outlined"
          disabled={downloading}
          onClick={() => onDownload('csv')}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          {t.downloadCsv}
        </Button>
      </Stack>

      <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
        {finalized ? (
          <Stack
            spacing={1.5}
            sx={{
              alignItems: 'flex-start',
            }}
          >
            <Alert severity="info">
              {t.finalizedOn}{' '}
              {draft.finalizedAt ? new Date(draft.finalizedAt).toLocaleDateString(locale) : ''}
            </Alert>
            <Button
              variant="outlined"
              color="warning"
              disabled={busy}
              onClick={onReopen}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {t.reopen}
            </Button>
          </Stack>
        ) : (
          <Stack
            spacing={1.5}
            sx={{
              alignItems: 'flex-start',
            }}
          >
            <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{t.finalizeHint}</Typography>
            <Button
              variant="contained"
              disabled={busy}
              onClick={onFinalize}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {t.finalize}
            </Button>
          </Stack>
        )}
      </Box>
    </Stack>
  );
}
