'use client';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';

/** The manual expense's date: a `yyyy-MM-dd` string in, the same out ('' when cleared). */
export function ExpenseDatePicker({
  id,
  value,
  onChange,
  ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}): React.JSX.Element {
  return (
    <DatePicker
      value={value ? parseISO(value) : null}
      onChange={(d: Date | null) => onChange(d && isValid(d) ? format(d, 'yyyy-MM-dd') : '')}
      slotProps={{
        textField: {
          id,
          fullWidth: true,
          variant: 'standard',
          InputProps: { disableUnderline: true },
          inputProps: { 'aria-label': ariaLabel },
          sx: {
            '& .MuiInputBase-input': {
              p: 0,
              fontSize: 16,
              color: 'var(--foreground)',
            },
          },
        } as never,
      }}
    />
  );
}
