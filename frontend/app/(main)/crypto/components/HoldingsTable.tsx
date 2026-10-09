import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type React from 'react';
import type { CryptoHolding } from '../hooks/useCrypto';
import { TokenIcon } from './TokenIcon';

type HoldingsTableLabels = {
  title: string;
  asset: string;
  balance: string;
  price: string;
  worth: string;
  avgCost: string;
  unrealized: string;
  basisUnknown: string;
};

type HoldingsTableProps = {
  holdings: CryptoHolding[];
  labels: HoldingsTableLabels;
  locale: string;
  money: (value: number) => string;
};

const numberCell = { fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' } as const;

/**
 * Profit not taken yet, against what the coins cost. An asset with no purchase on
 * record shows nothing rather than a gain measured from zero.
 */
function GainCell({
  holding,
  money,
}: {
  holding: CryptoHolding;
  money: (value: number) => string;
}): React.JSX.Element {
  if (holding.unrealized === null) {
    return <span>—</span>;
  }
  const positive = holding.unrealized >= 0;
  return (
    <Typography
      component="span"
      variant="body2"
      sx={{ color: positive ? 'var(--ff-dash-success)' : 'var(--ff-dash-critical)' }}
    >
      {positive ? '+' : ''}
      {money(holding.unrealized)}
      {holding.unrealizedPercent === null ? null : (
        <Typography component="span" variant="caption" sx={{ ml: 0.75, color: 'text.secondary' }}>
          {positive ? '+' : ''}
          {holding.unrealizedPercent}%
        </Typography>
      )}
    </Typography>
  );
}

export function HoldingsTable({
  holdings,
  labels,
  locale,
  money,
}: HoldingsTableProps): React.JSX.Element {
  // On-chain amounts carry up to 18 decimals; six is enough to read a balance.
  const amountFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Typography variant="subtitle1" fontWeight={600} sx={{ px: 3, pt: 3, pb: 1.5 }}>
        {labels.title}
      </Typography>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ '& td, & th': { px: 3 } }}>
          <TableHead>
            <TableRow>
              <TableCell>{labels.asset}</TableCell>
              <TableCell align="right">{labels.balance}</TableCell>
              <TableCell align="right">{labels.price}</TableCell>
              <TableCell align="right">{labels.avgCost}</TableCell>
              <TableCell align="right">{labels.unrealized}</TableCell>
              <TableCell align="right">{labels.worth}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {holdings.map(holding => (
              <TableRow key={holding.asset} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <TokenIcon asset={holding.asset} />
                    <Typography variant="body2" fontWeight={600}>
                      {holding.asset}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={numberCell}>
                  {amountFormat.format(Number(holding.amount))}
                </TableCell>
                <TableCell align="right" sx={{ ...numberCell, color: 'text.secondary' }}>
                  {money(holding.price)}
                </TableCell>
                <TableCell align="right" sx={{ ...numberCell, color: 'text.secondary' }}>
                  {holding.avgCost === null ? (
                    <Typography component="span" variant="body2" color="text.disabled">
                      {labels.basisUnknown}
                    </Typography>
                  ) : (
                    money(holding.avgCost)
                  )}
                </TableCell>
                <TableCell align="right" sx={numberCell}>
                  <GainCell holding={holding} money={money} />
                </TableCell>
                <TableCell align="right" sx={{ ...numberCell, fontWeight: 600 }}>
                  {money(holding.value)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Paper>
  );
}
