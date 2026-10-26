'use client';

import Box from '@mui/material/Box';
import type { ReactNode } from 'react';
import { ChevronDown } from '@/app/components/icons';
import { FieldLabel } from './OnboardingField';

interface PickerFieldProps {
  id: string;
  label: string;
  /** The chosen value; `null` shows the placeholder. */
  value: ReactNode | null;
  placeholder: string;
  onOpen: () => void;
}

/** A form-sized field that opens its list in a sidebar instead of a dropdown. */
export function PickerField({ id, label, value, placeholder, onOpen }: PickerFieldProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <FieldLabel htmlFor={id} id={`${id}-label`}>
        {label}
      </FieldLabel>
      <Box
        component="button"
        type="button"
        id={id}
        aria-haspopup="dialog"
        // Read as "Currency, USD": the label alone would hide what is chosen.
        aria-labelledby={`${id}-label ${id}-value`}
        onClick={onOpen}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.25,
          width: '100%',
          height: 48,
          px: 1.75,
          fontSize: 16,
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: 'pointer',
          color: value === null ? 'var(--muted-foreground)' : 'var(--foreground)',
          bgcolor: 'transparent',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          transition: 'border-color 150ms ease',
          '&:hover': { borderColor: 'var(--foreground)' },
          '&:focus-visible': {
            outline: '2px solid var(--primary)',
            outlineOffset: 1,
          },
        }}
      >
        <Box
          component="span"
          id={`${id}-value`}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1.25,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value ?? placeholder}
        </Box>
        <ChevronDown size={18} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
      </Box>
    </Box>
  );
}
