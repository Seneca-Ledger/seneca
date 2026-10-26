'use client';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import type React from 'react';
import { useIntlayer } from '@/app/i18n';
import { type NetWorthDisplay, setNetWorthDisplay } from '../net-worth-display';

const labelSx = { '& .MuiFormControlLabel-label': { fontSize: 13, color: 'text.secondary' } };

/** How this viewer likes the chart drawn: an axis from zero, the all-time high. */
export function ChartDisplayOptions({ display }: { display: NetWorthDisplay }): React.JSX.Element {
  const t = useIntlayer('netWorthPage');
  return (
    <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
      <FormControlLabel
        sx={labelSx}
        control={
          <Checkbox
            size="small"
            checked={display.zeroBaseline}
            onChange={() => setNetWorthDisplay({ zeroBaseline: !display.zeroBaseline })}
          />
        }
        label={t.axisFromZero.value}
      />
      <FormControlLabel
        sx={labelSx}
        control={
          <Checkbox
            size="small"
            checked={display.allTimeHigh}
            onChange={() => setNetWorthDisplay({ allTimeHigh: !display.allTimeHigh })}
          />
        }
        label={t.showAllTimeHigh.value}
      />
    </Box>
  );
}
