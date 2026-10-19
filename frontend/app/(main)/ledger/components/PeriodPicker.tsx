'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import type React from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { useIntlayer } from '@/app/i18n';
import { isDateOnly } from '../ledger.helpers';

export interface Period {
  dateFrom: string;
  dateTo: string;
}

export function PeriodPicker({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}): React.ReactElement {
  const t = useIntlayer('ledgerPage');
  const set = (patch: Partial<Period>): void => {
    const next = { ...value, ...patch };
    if (isDateOnly(next.dateFrom) && isDateOnly(next.dateTo)) {
      onChange(next);
    }
  };
  return (
    <Stack direction="row" spacing={2}>
      <Box sx={{ width: 180 }}>
        <CustomDatePicker
          label={t.dateFrom.value}
          value={value.dateFrom}
          onChange={dateFrom => set({ dateFrom })}
          error={value.dateFrom > value.dateTo}
        />
      </Box>
      <Box sx={{ width: 180 }}>
        <CustomDatePicker
          label={t.dateTo.value}
          value={value.dateTo}
          onChange={dateTo => set({ dateTo })}
          error={value.dateFrom > value.dateTo}
        />
      </Box>
    </Stack>
  );
}
