import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { ArrowDownRight, ArrowUpRight } from '@/app/components/icons';
import { PRIVATE_CLASS } from '@/app/components/ui/private-amount';
import { formatMoney } from '@/app/lib/format-money';
import { formatStoredDateWithOptions } from '@/app/lib/user-format-store';
import { type CryptoTransaction, isSupportedAddress } from '../hooks/useCrypto';
import { shortenAddress } from './address';

export type CryptoTransactionsTableLabels = {
  title: string;
  empty: string;
  date: string;
  wallet: string;
  counterparty: string;
  amount: string;
  worth: string;
  received: string;
  sent: string;
  /** "Received from {counterparty}". */
  receivedFrom: string;
  /** "Sent to {counterparty}". */
  sentTo: string;
};

type CryptoTransactionsTableProps = {
  transactions: CryptoTransaction[];
  labels: CryptoTransactionsTableLabels;
  locale: string;
  /** Inside another card: no frame of its own and no title. */
  embedded?: boolean;
};

const numberCell = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;
const DAY_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };

function counterpartyText(
  transaction: CryptoTransaction,
  labels: CryptoTransactionsTableLabels,
): string {
  const incoming = transaction.direction === 'in';
  if (!transaction.counterparty) {
    return incoming ? labels.received : labels.sent;
  }
  const party = isSupportedAddress(transaction.counterparty)
    ? shortenAddress(transaction.counterparty)
    : transaction.counterparty;
  return (incoming ? labels.receivedFrom : labels.sentTo).replace('{counterparty}', party);
}

/** The wallet's name alone: its network would only repeat it ("Tron · Tron"). */
function walletName(transaction: CryptoTransaction): string {
  if (transaction.walletLabel) {
    return transaction.walletLabel;
  }
  return transaction.walletAddress ? shortenAddress(transaction.walletAddress) : '—';
}

function coinAmount(transaction: CryptoTransaction, format: Intl.NumberFormat): string {
  const amount = transaction.cryptoAmount ? format.format(Number(transaction.cryptoAmount)) : '—';
  return transaction.asset ? `${amount} ${transaction.asset}` : amount;
}

export function CryptoTransactionsTable({
  transactions,
  labels,
  locale,
  embedded = false,
}: CryptoTransactionsTableProps): React.JSX.Element {
  const amountFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
  const edge = embedded ? 0 : 2;

  const body =
    transactions.length === 0 ? (
      <Typography
        variant="body2"
        sx={{
          px: edge,
          pb: embedded ? 0 : 3,
          pt: embedded ? 0 : 1,
          color: 'var(--muted-foreground)',
        }}
      >
        {labels.empty}
      </Typography>
    ) : (
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{labels.date}</TableCell>
              <TableCell>{labels.counterparty}</TableCell>
              <TableCell>{labels.wallet}</TableCell>
              <TableCell align="right">{labels.amount}</TableCell>
              <TableCell align="right">{labels.worth}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map(transaction => {
              const incoming = transaction.direction === 'in';
              const sign = incoming ? '+' : '−';
              return (
                <TableRow key={transaction.id} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell sx={{ ...numberCell, color: 'var(--muted-foreground)' }}>
                    {formatStoredDateWithOptions(transaction.date, DAY_FORMAT, locale)}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box
                        component="span"
                        sx={{ display: 'inline-flex', color: 'var(--muted-foreground)' }}
                      >
                        {incoming ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                      </Box>
                      <Typography
                        variant="body2"
                        component="span"
                        title={transaction.counterparty ?? undefined}
                      >
                        {counterpartyText(transaction, labels)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ color: 'var(--muted-foreground)', whiteSpace: 'nowrap' }}>
                    {walletName(transaction)}
                  </TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      ...numberCell,
                      fontWeight: 500,
                      color: incoming ? 'var(--money-up)' : 'var(--foreground)',
                    }}
                  >
                    {sign}
                    {coinAmount(transaction, amountFormat)}
                  </TableCell>
                  <TableCell
                    align="right"
                    className={PRIVATE_CLASS}
                    sx={{ ...numberCell, fontWeight: 400, color: 'var(--foreground)' }}
                  >
                    {formatMoney(transaction.amount, transaction.currency, locale)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>
    );

  if (embedded) {
    return body;
  }

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 600,
          px: 2,
          pt: 2,
          pb: 1,
        }}
      >
        {labels.title}
      </Typography>
      {body}
    </Paper>
  );
}
