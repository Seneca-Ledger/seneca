'use client';

import { Box, Paper, Typography } from '@mui/material';
import { useIntlayer } from '@/app/i18n';
import { formatStoredDate } from '@/app/lib/user-format-store';
import type { EditableReceiptData, GmailReceipt } from '../hooks/useGmailReceiptData';

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  color?: string;
}

function MetricCard({ label, value, color }: MetricCardProps): React.ReactElement {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'grey.200', p: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.5, color: color || 'text.primary' }}>
        {value}
      </Typography>
    </Paper>
  );
}

const formatCurrencyAmount = (amount: number, currency: string): string => {
  if (!Number.isFinite(amount)) {
    return `0 ${currency}`;
  }
  return `${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

interface SummaryMetricsProps {
  editedData: EditableReceiptData;
  receipt: GmailReceipt;
  income: number;
  expense: number;
  currency: string;
  confidencePercent: number | null;
  isLowConfidence: boolean;
}

export function SummaryMetrics({
  editedData,
  receipt,
  income,
  expense,
  currency,
  confidencePercent,
  isLowConfidence,
}: SummaryMetricsProps): React.ReactElement {
  const t = useIntlayer('gmailReceiptPage');
  const dateValue = editedData.date
    ? formatStoredDate(editedData.date)
    : formatStoredDate(receipt.receivedAt);

  return (
    <Box
      sx={{
        mb: 3,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' },
        gap: 2,
      }}
    >
      <MetricCard label={t.metrics.date.value} value={dateValue} />
      <MetricCard
        label={t.metrics.income.value}
        value={formatCurrencyAmount(income, currency)}
        color="success.main"
      />
      <MetricCard
        label={t.metrics.expense.value}
        value={formatCurrencyAmount(expense, currency)}
        color="error.main"
      />
      <MetricCard
        label={t.metrics.confidence.value}
        value={confidencePercent === null ? t.metrics.notAvailable.value : `${confidencePercent}%`}
        color={isLowConfidence ? 'warning.main' : 'success.main'}
      />
    </Box>
  );
}
