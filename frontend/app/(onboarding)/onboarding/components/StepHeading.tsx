'use client';

import Box from '@mui/material/Box';
import { useEffect, useRef } from 'react';

interface StepHeadingProps {
  title: string;
  subtitle?: string;
  /** A short line above the title, e.g. the greeting on the first step. */
  eyebrow?: string;
}

/**
 * Each step's heading. It takes focus when the step appears, so a keyboard or
 * screen-reader user lands on the new question instead of on the Next button.
 */
export function StepHeading({ title, subtitle, eyebrow }: StepHeadingProps) {
  const ref = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {eyebrow ? (
        <Box component="p" sx={{ m: 0, fontSize: 15, color: 'var(--primary)', fontWeight: 500 }}>
          {eyebrow}
        </Box>
      ) : null}
      <Box
        component="h1"
        ref={ref}
        tabIndex={-1}
        sx={{
          m: 0,
          fontSize: { xs: 26, sm: 32 },
          lineHeight: 1.15,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          color: 'var(--foreground)',
          '&:focus': { outline: 'none' },
        }}
      >
        {title}
      </Box>
      {subtitle ? (
        <Box
          component="p"
          sx={{ m: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--muted-foreground)' }}
        >
          {subtitle}
        </Box>
      ) : null}
    </Box>
  );
}
