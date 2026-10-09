'use client';

import Box from '@mui/material/Box';
import { visuallyHidden } from '@mui/utils';

interface OnboardingProgressProps {
  currentStep: number;
  stepLabels: string[];
  /** "Step 2 of 5", already filled in. */
  progressLabel: string;
}

/** The auth pages' lockup, smaller and flush left: it marks the page, it does not head it. */
export function OnboardingLogo() {
  return (
    <div
      className="lumio-auth-logo"
      role="img"
      aria-label="Lumio"
      style={{ margin: 0, height: 28 }}
    />
  );
}

/**
 * The logo and a row of hairline segments, one per step. The step names are
 * there for screen readers only: the heading of the step says where you are.
 */
export function OnboardingProgress({
  currentStep,
  stepLabels,
  progressLabel,
}: OnboardingProgressProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <OnboardingLogo />
        <Box
          component="span"
          sx={{
            fontSize: 13,
            color: 'var(--muted-foreground)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {progressLabel}
        </Box>
      </Box>

      <Box component="ol" sx={{ display: 'flex', gap: 0.75, m: 0, p: 0, listStyle: 'none' }}>
        {stepLabels.map((label, index) => (
          <Box
            component="li"
            key={label}
            aria-current={index === currentStep ? 'step' : undefined}
            sx={{
              flex: 1,
              height: 2,
              borderRadius: 999,
              bgcolor: index <= currentStep ? 'var(--primary)' : 'var(--border-color)',
              transition: 'background-color 240ms ease',
            }}
          >
            <Box component="span" sx={visuallyHidden}>
              {label}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
