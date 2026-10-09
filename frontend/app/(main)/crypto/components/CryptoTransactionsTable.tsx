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
import { formatMoney } from '@/app/lib/format-money';
import { type CryptoTransaction, isSupportedAddress } from '../hooks/useCrypto';
import { shortenAddress } from './address';
import { TokenIcon } from './TokenIcon';

type CryptoTransactionsTableLabels = {
  title: string;
  empty: string;
  date: string;
  wallet: string;
  counterparty: string;
  amount: string;
  worth: string;
  received: string;
  sent: string;
};

type CryptoTransactionsTableProps = {
  transactions: CryptoTransaction[];
  labels: CryptoTransactionsTableLabels;
  locale: string;
};

const numberCell = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;

export function CryptoTransactionsTable({
  transactions,
  labels,
  locale,
}: CryptoTransactionsTableProps): React.JSX.Element {
  const amountFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
  const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ px: 2, pt: 2, pb: 1 }}>
        {labels.title}
      </Typography>

      {transactions.length === 0 ? (
        <Typography variant="body2" sx={{ px: 2, pb: 3, pt: 1, color: 'text.secondary' }}>
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
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                      {dateFormat.format(new Date(transaction.date))}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          component="span"
                          sx={{
                            display: 'inline-flex',
                            color: incoming ? 'success.main' : 'text.secondary',
                          }}
                        >
                          {incoming ? <ArrowDownRight size={16} /> : <ArrowUpRight size={16} />}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2">
                            {incoming ? labels.received : labels.sent}
                          </Typography>
                          {transaction.counterparty && (
                            <Typography
                              variant="caption"
                              sx={{ color: 'text.secondary', fontFamily: 'monospace' }}
                            >
                              {isSupportedAddress(transaction.counterparty)
                                ? shortenAddress(transaction.counterparty)
                                : transaction.counterparty}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" component="span" sx={{ display: 'block' }}>
                        {transaction.walletLabel ??
                          (transaction.walletAddress
                            ? shortenAddress(transaction.walletAddress)
                            : '—')}
                      </Typography>
                      {transaction.walletChainName && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {transaction.walletChainName}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={numberCell}>
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.75,
                          color: incoming ? 'success.main' : 'text.primary',
                        }}
                      >
                        {transaction.asset && <TokenIcon asset={transaction.asset} size={16} />}
                        {sign}
                        {transaction.cryptoAmount
                          ? amountFormat.format(Number(transaction.cryptoAmount))
                          : '—'}{' '}
                        {transaction.asset}
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ ...numberCell, fontWeight: 600 }}>
                      {formatMoney(transaction.amount, transaction.currency, locale)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
}
