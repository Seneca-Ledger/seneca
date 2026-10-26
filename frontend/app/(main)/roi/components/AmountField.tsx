'use client';

import Box from '@mui/material/Box';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useId, useState } from 'react';
import { parseAmount } from '../roi-model';

/**
 * An amount with its label above it, the currency inside, an example as the
 * placeholder, and thousands grouped once the field is left — raw while typing,
 * so the caret never jumps.
 */
export function AmountField({
  label,
  value,
  onChange,
  currencySymbol,
  locale,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currencySymbol: string;
  locale: string;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const parsed = parseAmount(value);
  const shown =
    focused || parsed === null
      ? value
      : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(parsed);
  return (
    <Box>
      <Typography
        component="label"
        htmlFor={id}
        sx={{ display: 'block', mb: 0.75, fontSize: 13, color: 'var(--text-muted)' }}
      >
        {label}
      </Typography>
      <TextField
        id={id}
        fullWidth
        size="small"
        value={shown}
        placeholder="0"
        onChange={event => onChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        slotProps={{
          htmlInput: { inputMode: 'decimal' },
          input: {
            startAdornment: <InputAdornment position="start">{currencySymbol}</InputAdornment>,
          },
        }}
      />
    </Box>
  );
}
