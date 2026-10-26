import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import type React from 'react';
import { Plus } from '@/app/components/icons';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import { formatMoney } from '@/app/lib/format-money';
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
  share: string;
  addHolding: string;
};

type HoldingsTableProps = {
  holdings: CryptoHolding[];
  labels: HoldingsTableLabels;
  locale: string;
  currency: string;
  money: (value: number) => string;
  /** Opens the hand-kept holdings; a ghost button in the header, not a card of its own. */
  onAddHolding: () => void;
};

/** Pegged coins: their price only moves in the third and fourth decimals. */
const STABLECOINS = new Set([
  'USDT',
  'USDC',
  'DAI',
  'BUSD',
  'TUSD',
  'USDP',
  'FDUSD',
  'PYUSD',
  'USDE',
  'EURC',
  'EURT',
]);

/** A gain or loss under this share of the cost is noise and stays uncoloured. */
const SIGNAL_PERCENT = 0.5;

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
  const percent = holding.unrealizedPercent;
  const color =
    percent === null || Math.abs(percent) < SIGNAL_PERCENT
      ? 'text.primary'
      : percent > 0
        ? 'var(--money-up)'
        : 'var(--money-down)';
  return (
    <Typography
      component="span"
      variant="body2"
      className={PRIVATE_CLASS}
      sx={{ color, fontVariantNumeric: 'tabular-nums' }}
    >
      {holding.unrealized > 0 ? '+' : ''}
      {money(holding.unrealized)}
      {percent === null ? null : (
        <Box component="span" sx={{ ml: 0.75, fontSize: 13, color: 'var(--text-muted)' }}>
          {percent > 0 ? '+' : ''}
          {percent}%
        </Box>
      )}
    </Typography>
  );
}

/** Its slice of the portfolio, as a figure and a thin bar. */
function ShareCell({ share }: { share: number }): React.JSX.Element {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      <Box
        aria-hidden
        sx={{
          width: 64,
          height: 4,
          borderRadius: 2,
          bgcolor: 'var(--icon-badge-bg)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{ width: `${Math.min(share, 100)}%`, height: '100%', bgcolor: 'var(--primary)' }}
        />
      </Box>
      <Box component="span" className={PRIVATE_CLASS} sx={{ minWidth: 36, textAlign: 'right' }}>
        {share < 1 ? '<1%' : `${Math.round(share)}%`}
      </Box>
    </Box>
  );
}

export function HoldingsTable({
  holdings,
  labels,
  locale,
  currency,
  money,
  onAddHolding,
}: HoldingsTableProps): React.JSX.Element {
  // On-chain amounts carry up to 18 decimals; six is enough to read a balance.
  const amountFormat = new Intl.NumberFormat(locale, { maximumFractionDigits: 6 });
  const total = holdings.reduce((sum, holding) => sum + holding.value, 0);
  // A stablecoin at "$1.00" bought at "$1.00" showing a loss looks like a bug;
  // four decimals ($0.9991) say where it comes from.
  const unitPrice = (asset: string, value: number) =>
    STABLECOINS.has(asset.toUpperCase())
      ? formatMoney(value, currency, locale, { fractionDigits: 4 })
      : money(value);

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          pt: 3,
          pb: 1.5,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
          }}
        >
          {labels.title}
        </Typography>
        <Button size="small" variant="text" onClick={onAddHolding}>
          <Plus size={16} aria-hidden />
          {labels.addHolding}
        </Button>
      </Box>
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ '& td, & th': { px: 3 } }}>
          <TableHead>
            <TableRow>
              <TableCell>{labels.asset}</TableCell>
              <TableCell align="right">{labels.balance}</TableCell>
              <TableCell align="right">{labels.price}</TableCell>
              <TableCell align="right">{labels.avgCost}</TableCell>
              <TableCell align="right">{labels.unrealized}</TableCell>
              <TableCell align="right">{labels.share}</TableCell>
              <TableCell align="right">{labels.worth}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {holdings.map(holding => (
              <TableRow key={holding.asset} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <TokenIcon asset={holding.asset} />
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 500,
                      }}
                    >
                      {holding.asset}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell align="right" sx={numberCell}>
                  {amountFormat.format(Number(holding.amount))}
                </TableCell>
                <TableCell align="right" sx={{ ...numberCell, color: 'text.secondary' }}>
                  {unitPrice(holding.asset, holding.price)}
                </TableCell>
                <TableCell align="right" sx={{ ...numberCell, color: 'text.secondary' }}>
                  {holding.avgCost === null ? (
                    <Typography
                      component="span"
                      variant="body2"
                      sx={{
                        color: 'text.disabled',
                      }}
                    >
                      {labels.basisUnknown}
                    </Typography>
                  ) : (
                    <PrivateAmount>{unitPrice(holding.asset, holding.avgCost)}</PrivateAmount>
                  )}
                </TableCell>
                <TableCell align="right" sx={numberCell}>
                  <GainCell holding={holding} money={money} />
                </TableCell>
                <TableCell align="right" sx={{ ...numberCell, color: 'text.secondary' }}>
                  <ShareCell share={total > 0 ? (holding.value / total) * 100 : 0} />
                </TableCell>
                <TableCell
                  align="right"
                  className={PRIVATE_CLASS}
                  sx={{ ...numberCell, fontWeight: 500 }}
                >
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
