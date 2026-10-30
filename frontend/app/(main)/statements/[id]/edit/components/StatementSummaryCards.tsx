'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import type { LucideIcon } from '@/app/components/icons';
import { fillTemplateNodes, PrivateAmount } from '@/app/components/ui/private-amount';
import { Landmark, TrayArrowDown, Wallet, WalletArrowUp } from '@/app/lib/category-line-icons';

type StatementSummaryCardsProps = {
  opening: number | null;
  expense: number;
  income: number;
  closing: number | null;
  /** The closing balance the bank printed, to check ours against. */
  bankClosing: number | null;
  closingMatches: boolean;
  currency: string | null;
  formatNumber: (n?: number | null) => string;
  labels: Record<string, { value?: string } | undefined>;
};

/**
 * Summary: the figures in ink, the currency beside them, and the closing
 * balance they add up to, checked against the one the bank printed — the
 * plainest sign the statement was read right. Each card carries the faint
 * line icon of the dashboard's figure cards, the same one for the same
 * meaning (money in, money out), so the eye finds a card before reading it.
 */
export function StatementSummaryCards({
  opening,
  expense,
  income,
  closing,
  bankClosing,
  closingMatches,
  currency,
  formatNumber,
  labels,
}: StatementSummaryCardsProps): React.ReactElement {
  const cards: Array<{ key: string; label?: string; value: number | null; icon: LucideIcon }> = [
    { key: 'start', label: labels.balanceStart?.value, value: opening, icon: Wallet },
    { key: 'expense', label: labels.expenses?.value, value: expense, icon: WalletArrowUp },
    { key: 'income', label: labels.income?.value, value: income, icon: TrayArrowDown },
    { key: 'end', label: labels.closingBalance?.value, value: closing, icon: Landmark },
  ];
  return (
    <Box
      sx={{
        mb: 2,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' },
        gap: 2,
      }}
    >
      {cards.map(({ key, label, value, icon: Icon }) => (
        <Paper
          key={key}
          elevation={0}
          // Its own stacking context and clipped edge, so the icon sits under the text.
          sx={{
            position: 'relative',
            overflow: 'hidden',
            isolation: 'isolate',
            border: '1px solid',
            borderColor: 'divider',
            p: 2,
          }}
        >
          <Icon className="seneca-dashboard__stat-icon" aria-hidden="true" />
          <Typography sx={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</Typography>
          <Typography
            sx={{ fontSize: 16, fontWeight: 500, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}
          >
            {value === null ? (
              labels.notSpecified?.value
            ) : (
              <>
                <PrivateAmount>{formatNumber(value)}</PrivateAmount>
                {currency ? (
                  <Box
                    component="span"
                    sx={{ fontSize: 13, fontWeight: 400, color: 'var(--muted-foreground)' }}
                  >
                    {' '}
                    {currency}
                  </Box>
                ) : null}
              </>
            )}
          </Typography>
          {key === 'end' && closing !== null && bankClosing !== null ? (
            <Typography
              sx={{
                mt: 0.5,
                fontSize: 13,
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              <Box
                aria-hidden
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: closingMatches ? 'var(--money-up)' : 'var(--attention)',
                }}
              />
              {closingMatches
                ? labels.closingMatches?.value
                : fillTemplateNodes(labels.closingBankSays?.value ?? '', {
                    amount: formatNumber(bankClosing),
                  })}
            </Typography>
          ) : null}
        </Paper>
      ))}
    </Box>
  );
}
