'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { useState } from 'react';
import { TextTabs } from '@/app/components/ui/text-tabs';
import type { CryptoGains, CryptoTransaction } from '../hooks/useCrypto';
import {
  CryptoTransactionsTable,
  type CryptoTransactionsTableLabels,
} from './CryptoTransactionsTable';
import { GainsBody, type GainsCardLabels, GainsControls } from './GainsCard';

type ActivityTab = 'transactions' | 'gains';

type ActivityCardProps = {
  transactions: CryptoTransaction[];
  /** Null while the report loads: the tab stays, its body waits. */
  gains: CryptoGains | null;
  gainsYear: number | null;
  gainsYears: number[];
  onGainsYearChange: (year: number | null) => void;
  locale: string;
  money: (value: number) => string;
  labels: {
    /** Accessible name of the tab switch. */
    tabs: string;
    /** `title` is the tab's label. */
    transactions: CryptoTransactionsTableLabels;
    /** `title` is the tab's label; `hint` sits under the tabs on this tab. */
    gains: GainsCardLabels;
  };
};

/** Wallet activity in one card: the raw transfers, or the sales they add up to. */
export function ActivityCard({
  transactions,
  gains,
  gainsYear,
  gainsYears,
  onGainsYearChange,
  locale,
  money,
  labels,
}: ActivityCardProps): React.JSX.Element {
  const [tab, setTab] = useState<ActivityTab>('transactions');

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          minHeight: 40,
        }}
      >
        <TextTabs<ActivityTab>
          value={tab}
          onChange={setTab}
          ariaLabel={labels.tabs}
          options={[
            { value: 'transactions', label: labels.transactions.title },
            { value: 'gains', label: labels.gains.title },
          ]}
        />
        {tab === 'gains' && gains && (
          <GainsControls
            gains={gains}
            year={gainsYear}
            years={gainsYears}
            labels={labels.gains}
            onYearChange={onGainsYearChange}
          />
        )}
      </Box>

      <Box role="tabpanel" sx={{ mt: 2 }}>
        {tab === 'transactions' ? (
          <CryptoTransactionsTable
            embedded
            transactions={transactions}
            labels={labels.transactions}
            locale={locale}
          />
        ) : (
          <>
            <Typography
              variant="body2"
              sx={{ fontSize: 13, color: 'var(--muted-foreground)', mb: 1.5 }}
            >
              {labels.gains.hint}
            </Typography>
            {gains && (
              <GainsBody gains={gains} labels={labels.gains} locale={locale} money={money} />
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}
