'use client';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import type { ReactNode } from 'react';

/** Plain label above the control, no floating notch: the wizard reads as a form, not a dialog. */
export function FieldLabel({
  htmlFor,
  id,
  children,
}: {
  htmlFor?: string;
  /** For controls that are not labelable elements (MUI Select): pass it as their `labelId`. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <Box
      component={htmlFor ? 'label' : 'span'}
      htmlFor={htmlFor}
      id={id}
      sx={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}
    >
      {children}
    </Box>
  );
}

interface OnboardingTextFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoComplete?: string;
}

export function OnboardingTextField({
  id,
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  autoComplete,
}: OnboardingTextFieldProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <TextField
        id={id}
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        multiline={multiline}
        minRows={multiline ? 2 : undefined}
        autoComplete={autoComplete}
        fullWidth
        slotProps={{
          input: { sx: multiline ? { fontSize: 16 } : { height: 48, fontSize: 16 } },
        }}
      />
    </Box>
  );
}
