'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { formatSummaryAmount } from '../editHelpers';

type EditSummaryPanelProps = {
  period: string;
  balanceStart: string;
  totalExpense: number;
  totalIncome: number;
  formatNumber: (n?: number | null) => string;
  labels: Record<string, { value: string }>;
};

type SummaryCardProps = { label: string; value: string; color?: string };

function SummaryCard({ label, value, color }: SummaryCardProps): React.ReactElement {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'grey.200', p: 2 }}>
      <Typography
        variant="caption"
        sx={{
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5, color: color ?? 'inherit' }}>
        {value}
      </Typography>
    </Paper>
  );
}

export function EditSummaryPanel({
  period,
  balanceStart,
  totalExpense,
  totalIncome,
  formatNumber,
  labels,
}: EditSummaryPanelProps): React.ReactElement {
  const ns = labels.notSpecified.value;
  const cards: SummaryCardProps[] = [
    { label: labels.period.value, value: period || ns },
    { label: labels.balanceStart.value, value: balanceStart || ns },
    {
      label: labels.expenses.value,
      value: formatSummaryAmount(totalExpense, formatNumber),
      color: 'error.main',
    },
    {
      label: labels.income.value,
      value: formatSummaryAmount(totalIncome, formatNumber),
      color: 'success.main',
    },
  ];
  return (
    <Box
      sx={{
        mb: 3,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
        gap: 2,
      }}
    >
      {cards.map(card => (
        <SummaryCard key={card.label} {...card} />
      ))}
    </Box>
  );
}
