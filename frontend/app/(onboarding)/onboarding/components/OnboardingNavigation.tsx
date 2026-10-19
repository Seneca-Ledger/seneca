'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { ArrowLeft } from '@/app/components/icons';

interface OnboardingNavigationProps {
  /** False on the first step of the first run: there is nowhere to go back to. */
  canGoBack: boolean;
  isSubmitting: boolean;
  /** The step still has an unanswered required question. */
  nextDisabled?: boolean;
  onBack: () => void;
  onNext: () => void;
  /** Present only on steps that may be left unanswered. */
  onSkip?: () => void;
  labels: {
    back: string;
    next: string;
    skip: string;
    saving: string;
  };
}

const quietButtonSx = {
  textTransform: 'none',
  fontWeight: 500,
  fontSize: 15,
  color: 'var(--muted-foreground)',
  px: 1.5,
  '&:hover': { color: 'var(--foreground)', bgcolor: 'transparent' },
} as const;

export function OnboardingNavigation({
  canGoBack,
  isSubmitting,
  nextDisabled = false,
  onBack,
  onNext,
  onSkip,
  labels,
}: OnboardingNavigationProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        pt: 3,
        borderTop: '1px solid var(--border-color)',
      }}
    >
      {canGoBack ? (
        <Button
          variant="text"
          onClick={onBack}
          disabled={isSubmitting}
          startIcon={<ArrowLeft size={18} />}
          sx={{ ...quietButtonSx, ml: -1.5 }}
        >
          {labels.back}
        </Button>
      ) : null}

      <Box sx={{ flex: 1 }} />

      {onSkip ? (
        <Button variant="text" onClick={onSkip} disabled={isSubmitting} sx={quietButtonSx}>
          {labels.skip}
        </Button>
      ) : null}

      <Button
        variant="contained"
        disableElevation
        onClick={onNext}
        disabled={isSubmitting || nextDisabled}
        sx={{
          textTransform: 'none',
          fontWeight: 600,
          fontSize: 15,
          height: 44,
          px: 3,
          borderRadius: 'var(--radius-md)',
          bgcolor: 'var(--primary-fill)',
          color: 'var(--primary-foreground)',
          '&:hover': { bgcolor: 'var(--primary-fill-hover)' },
          // The sx fill above outranks MUI's own disabled colours, so restate them.
          '&.Mui-disabled': { bgcolor: 'var(--muted)', color: 'var(--muted-foreground)' },
        }}
      >
        {isSubmitting ? (
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} color="inherit" />
            {labels.saving}
          </Box>
        ) : (
          labels.next
        )}
      </Button>
    </Box>
  );
}
