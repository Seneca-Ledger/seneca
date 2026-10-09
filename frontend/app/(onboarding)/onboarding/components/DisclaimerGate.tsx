'use client';

import { Alert, Box, Button, Checkbox, CircularProgress, Stack, Typography } from '@mui/material';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/app/lib/api';
import { OnboardingLayout } from './OnboardingLayout';
import { OnboardingLogo } from './OnboardingProgress';
import { StepHeading } from './StepHeading';

interface DisclaimerStatus {
  version: string;
  accepted: boolean;
}

/**
 * Tracks whether the signed-in user has accepted the current disclaimer.
 *
 * The server decides, by comparing the stored version against the current one,
 * so bumping the text re-prompts everyone without a frontend release.
 */
export function useDisclaimerAcceptance(): {
  loading: boolean;
  accepted: boolean;
  markAccepted: () => void;
} {
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .get<DisclaimerStatus>('/users/me/disclaimer')
      .then(response => {
        if (!cancelled) {
          setAccepted(response.data.accepted);
        }
      })
      .catch(() => {
        // A failed check must not become a silent bypass: leaving `accepted`
        // false keeps the gate closed and lets the user retry.
        if (!cancelled) {
          setAccepted(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const markAccepted = useCallback(() => setAccepted(true), []);

  return { loading, accepted, markAccepted };
}

interface DisclaimerGateProps {
  title: string;
  intro: string;
  points: string[];
  consentLabel: string;
  acceptLabel: string;
  savingLabel: string;
  errorLabel: string;
  onAccepted: () => void;
}

/**
 * Blocking acknowledgement shown once, before onboarding starts.
 *
 * Deliberately not a wizard step: the wizard offers "skip" and "skip all", and
 * a disclaimer the user can skip past records nothing worth having.
 */
export function DisclaimerGate({
  title,
  intro,
  points,
  consentLabel,
  acceptLabel,
  savingLabel,
  errorLabel,
  onAccepted,
}: DisclaimerGateProps): React.ReactElement {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);

  const handleAccept = async (): Promise<void> => {
    setSubmitting(true);
    setFailed(false);

    await (async () => {
      await apiClient.post('/users/me/disclaimer');
      onAccepted();
    })()
      .catch(async () => {
        // Only advance once the acceptance is actually recorded — otherwise the
        // user believes they consented and the audit trail disagrees.
        setFailed(true);
      })
      .finally(async () => {
        setSubmitting(false);
      });
  };

  return (
    <OnboardingLayout header={<OnboardingLogo />}>
      <Stack spacing={3}>
        <StepHeading title={title} subtitle={intro} />

        <Stack component="ul" spacing={1.25} sx={{ listStyle: 'disc', m: 0, pl: 2.5 }}>
          {points.map(point => (
            <Typography
              key={point}
              component="li"
              sx={{ fontSize: 14, lineHeight: 1.7, color: 'var(--muted-foreground)' }}
            >
              {point}
            </Typography>
          ))}
        </Stack>

        {failed ? <Alert severity="error">{errorLabel}</Alert> : null}

        <Box
          component="label"
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.25,
            pt: 3,
            cursor: 'pointer',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <Checkbox
            checked={checked}
            onChange={event => setChecked(event.target.checked)}
            disabled={submitting}
            sx={{ p: 0, mt: '2px' }}
            inputProps={{ 'aria-label': consentLabel }}
          />
          <Typography sx={{ fontSize: 14, lineHeight: 1.6, color: 'var(--foreground)' }}>
            {consentLabel}
          </Typography>
        </Box>

        <Button
          variant="contained"
          disableElevation
          onClick={handleAccept}
          disabled={!checked || submitting}
          sx={{
            alignSelf: 'flex-start',
            height: 44,
            px: 3,
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: 15,
            textTransform: 'none',
            bgcolor: 'var(--primary-fill)',
            color: 'var(--primary-foreground)',
            '&:hover': { bgcolor: 'var(--primary-fill-hover)' },
          }}
        >
          {submitting ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={16} color="inherit" />
              <span>{savingLabel}</span>
            </Stack>
          ) : (
            acceptLabel
          )}
        </Button>
      </Stack>
    </OnboardingLayout>
  );
}
