'use client';

import CircularProgress, { type CircularProgressProps } from '@mui/material/CircularProgress';
import { useIntlayer } from '@/app/i18n';

export interface SpinnerProps extends Omit<CircularProgressProps, 'aria-label'> {
  label?: string;
  className?: string;
}

function Spinner({ label, size = 16, className, ...props }: SpinnerProps) {
  const t = useIntlayer('uiShell');
  return (
    <CircularProgress
      role="status"
      aria-label={label ?? t.loading.value}
      size={size}
      className={className}
      {...props}
    />
  );
}

export { Spinner };
