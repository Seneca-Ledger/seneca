'use client';

import { Alert, Box, Button, Checkbox, CircularProgress, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useState } from 'react';
import { useIntlayer } from '@/app/i18n';
import { tokens } from '@/lib/theme-tokens';

interface TaxDisclaimerGateProps {
  accepting: boolean;
  failed: boolean;
  onAccept: () => void;
}

/**
 * Blocking acknowledgement before any figure is shown.
 *
 * The first point is the one the feature stands on — a draft is only as good
 * as daily, complete tracking — so it is set apart from the other two. The
 * acceptance itself is recorded server-side per text revision; finalizing and
 * exporting are refused without it.
 */
export function TaxDisclaimerGate({
  accepting,
  failed,
  onAccept,
}: TaxDisclaimerGateProps): React.ReactElement {
  const t = useIntlayer('taxDeclarationPage');
  const [checked, setChecked] = useState(false);

  const points = [
    { key: 'daily', text: t.disclaimerDaily, emphasis: true },
    { key: 'notAdvice', text: t.disclaimerNotAdvice, emphasis: false },
    { key: 'confirm', text: t.disclaimerConfirm, emphasis: false },
  ];

  return (
    <Box
      data-tour-shot="tax-declaration-gate"
      sx={{
        maxWidth: 680,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: tokens.radius.lg,
        bgcolor: 'background.paper',
        p: { xs: 2.5, sm: 4 },
      }}
    >
      <Stack spacing={2.5}>
        <Typography component="h2" sx={{ fontSize: 20, fontWeight: 600, color: 'text.primary' }}>
          {t.disclaimerTitle}
        </Typography>

        <Typography sx={{ fontSize: 15, lineHeight: 1.7, color: 'text.secondary' }}>
          {t.disclaimerIntro}
        </Typography>

        <Stack component="ul" spacing={1.25} sx={{ listStyle: 'disc', m: 0, pl: 2.5 }}>
          {points.map(point => (
            <Typography
              key={point.key}
              component="li"
              sx={{
                fontSize: 14,
                lineHeight: 1.7,
                color: point.emphasis ? 'text.primary' : 'text.secondary',
                fontWeight: point.emphasis ? 600 : 400,
              }}
            >
              {point.text}
            </Typography>
          ))}
        </Stack>

        {failed ? <Alert severity="error">{t.actionError}</Alert> : null}

        <Box
          component="label"
          sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, cursor: 'pointer' }}
        >
          <Checkbox
            checked={checked}
            onChange={event => setChecked(event.target.checked)}
            disabled={accepting}
            sx={{ p: 0, mt: '2px' }}
            slotProps={{
              input: { 'aria-label': t.disclaimerConsent.value },
            }}
          />
          <Typography sx={{ fontSize: 14, lineHeight: 1.6, color: 'text.primary' }}>
            {t.disclaimerConsent}
          </Typography>
        </Box>

        <Button
          variant="contained"
          onClick={onAccept}
          disabled={!checked || accepting}
          sx={{
            alignSelf: 'flex-start',
            borderRadius: tokens.radius.md,
            fontWeight: 600,
            textTransform: 'none',
            px: 3,
          }}
        >
          {accepting ? <CircularProgress size={16} color="inherit" /> : t.disclaimerAccept}
        </Button>
      </Stack>
    </Box>
  );
}
