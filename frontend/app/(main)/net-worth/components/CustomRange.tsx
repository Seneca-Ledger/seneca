'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import type { NetWorthCustomRange } from '../hooks/useNetWorth';

interface CustomRangeProps {
  value: NetWorthCustomRange | null;
  /** The window the preset resolved to, so opening the picker starts from it. */
  fallback: NetWorthCustomRange | null;
  onChange: (range: NetWorthCustomRange | null) => void;
  labels: { custom: string; from: string; to: string };
}

/**
 * Two dates of the user's own choosing.
 *
 * Presets only ever answer the questions whoever wrote them thought of; the
 * one most often asked of a net worth chart — "what happened between these
 * two dates" — is not among them once someone has a few years of history.
 */
export function CustomRange({
  value,
  fallback,
  onChange,
  labels,
}: CustomRangeProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(value !== null);
  const from = value?.from ?? fallback?.from ?? '';
  const to = value?.to ?? fallback?.to ?? '';

  if (!isOpen) {
    return (
      <Button size="small" sx={{ textTransform: 'none' }} onClick={() => setIsOpen(true)}>
        {labels.custom}
      </Button>
    );
  }

  const apply = (next: Partial<NetWorthCustomRange>): void => {
    const merged = { from, to, ...next };
    if (merged.from && merged.to && merged.from <= merged.to) {
      onChange(merged);
    }
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <CustomDatePicker
        label={labels.from}
        value={from}
        onChange={next => apply({ from: next })}
        size="small"
      />
      <CustomDatePicker
        label={labels.to}
        value={to}
        onChange={next => apply({ to: next })}
        size="small"
      />
      <Button
        size="small"
        sx={{ textTransform: 'none' }}
        onClick={() => {
          setIsOpen(false);
          onChange(null);
        }}
      >
        ✕
      </Button>
    </Box>
  );
}
