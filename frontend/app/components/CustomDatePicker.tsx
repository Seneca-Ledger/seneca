'use client';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, isValid, parseISO } from 'date-fns';
import type React from 'react';
import { FORM_CONTROL_SX } from '@/app/components/ui/input';
import { resolvePickerFormat } from '@/app/lib/user-format';
import { useUserFormat } from '@/app/lib/user-format-store';

interface CustomDatePickerProps {
  value?: string | null;
  onChange: (date: string) => void;
  label?: React.ReactNode;
  placeholder?: string;
  helperText?: string;
  containerTestId?: string;
  /** Id of the text input, for an external `<label htmlFor>`. */
  id?: string;
  /** Match the tall form-control sizing used by Input/Select. */
  large?: boolean;
  /** Field size when not `large`; defaults to small. */
  size?: 'small' | 'medium';
  error?: boolean;
  /** Earliest and latest selectable days, as `yyyy-MM-dd`. */
  minDate?: string;
  maxDate?: string;
  /** A filter-sized field: "Sep 1, 2024" and a small calendar icon. */
  compact?: boolean;
}

const DATE_VALUE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const normalizeToDate = (value?: string | null): Date | null => {
  if (!value) {
    return null;
  }

  if (DATE_VALUE_REGEX.test(value)) {
    const d = parseISO(value);
    return isValid(d) ? d : null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
};

export default function CustomDatePicker({
  value,
  onChange,
  label,
  placeholder,
  helperText,
  containerTestId,
  id,
  large,
  size = 'small',
  error,
  minDate,
  maxDate,
  compact,
}: CustomDatePickerProps) {
  const dateValue = normalizeToDate(value);
  const { preferences } = useUserFormat();
  const displayFormat = resolvePickerFormat(preferences);

  const handleChange = (date: Date | null) => {
    if (date && isValid(date)) {
      onChange(format(date, 'yyyy-MM-dd'));
    } else {
      onChange('');
    }
  };

  return (
    <div data-testid={containerTestId}>
      <DatePicker
        label={label}
        value={dateValue}
        onChange={handleChange}
        format={compact ? 'MMM d, yyyy' : displayFormat}
        minDate={normalizeToDate(minDate) ?? undefined}
        maxDate={normalizeToDate(maxDate) ?? undefined}
        slotProps={{
          ...(compact ? { openPickerIcon: { fontSize: 'small' } } : {}),
          textField: {
            fullWidth: true,
            id,
            size: large ? 'medium' : size,
            error,
            sx: large ? { '& .MuiInputBase-root': FORM_CONTROL_SX } : undefined,
            helperText: helperText,
            placeholder: placeholder,
          } as any,
        }}
      />
    </div>
  );
}
