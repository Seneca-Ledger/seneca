'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Trash2 } from '@/app/components/icons';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';
import {
  ASSET_CLASSES,
  type InvestmentAccount,
  type InvestmentAssetClass,
  useInvestments,
} from '../hooks/useInvestments';

/**
 * Labels for every asset class net worth can show. `crypto` is not a holding
 * class any more — the wallets are — but the balance sheet still has a crypto
 * line, and it needs a name here. `metal` is a holding class, entered on the
 * metals card rather than in the holding form.
 */
export const ASSET_CLASS_KEYS: Record<InvestmentAssetClass | 'crypto' | 'metal', string> = {
  stock: 'classStock',
  etf: 'classEtf',
  fund: 'classFund',
  bond: 'classBond',
  crypto: 'classCrypto',
  metal: 'classMetal',
  cash: 'classCash',
  real_estate: 'classRealEstate',
  other: 'classOther',
};

interface InvestmentsCardProps {
  currency: string;
  locale: string;
}

const card = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: tokens.radius.md,
  bgcolor: 'background.paper',
  p: 3,
} as const;

function AddHoldingRow({
  account,
  onAdd,
  saving,
}: {
  account: InvestmentAccount;
  onAdd: (input: {
    symbol?: string | null;
    name?: string;
    assetClass: InvestmentAssetClass;
    quantity: number;
    price?: number;
    priceCurrency?: string;
  }) => Promise<unknown>;
  saving: boolean;
}) {
  const t = useIntlayer('netWorthPage');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [assetClass, setAssetClass] = useState<InvestmentAssetClass>('etf');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const canSave = (symbol.trim() || name.trim()) && Number(quantity) > 0;

  const submit = async () => {
    await onAdd({
      symbol: symbol.trim() || null,
      name: name.trim() || undefined,
      assetClass,
      quantity: Number(quantity),
      // Empty price with a symbol: the server fetches one.
      price: price.trim() ? Number(price) : undefined,
      priceCurrency: account.currency,
    });
    setSymbol('');
    setName('');
    setQuantity('');
    setPrice('');
  };

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center', mt: 1.5 }}>
      <TextField
        size="small"
        label={t.symbol.value}
        value={symbol}
        onChange={event => setSymbol(event.target.value)}
        sx={{ width: 120 }}
      />
      <TextField
        size="small"
        label={t.holdingName.value}
        value={name}
        onChange={event => setName(event.target.value)}
        sx={{ width: 160 }}
      />
      <Select
        size="small"
        value={assetClass}
        onChange={event => setAssetClass(event.target.value as InvestmentAssetClass)}
        inputProps={{ 'aria-label': t.assetClass.value }}
      >
        {ASSET_CLASSES.map(item => (
          <MenuItem key={item} value={item}>
            {t[ASSET_CLASS_KEYS[item] as 'classStock']}
          </MenuItem>
        ))}
      </Select>
      <TextField
        size="small"
        label={t.quantity.value}
        value={quantity}
        onChange={event => setQuantity(event.target.value)}
        inputProps={{ inputMode: 'decimal' }}
        sx={{ width: 100 }}
      />
      <TextField
        size="small"
        label={`${t.price.value} (${account.currency})`}
        value={price}
        onChange={event => setPrice(event.target.value)}
        inputProps={{ inputMode: 'decimal' }}
        sx={{ width: 130 }}
      />
      <Button size="small" variant="outlined" disabled={!canSave || saving} onClick={submit}>
        {t.addHolding}
      </Button>
    </Box>
  );
}

/** Investment and retirement accounts with their holdings, right under the net worth they feed. */
export function InvestmentsCard({ currency, locale }: InvestmentsCardProps) {
  const t = useIntlayer('netWorthPage');
  const {
    accounts,
    saving,
    createAccount,
    deleteAccount,
    addHolding,
    deleteHolding,
    refreshPrices,
  } = useInvestments();
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<'investment' | 'retirement'>('investment');
  const money = (value: number) => formatMoney(value, currency, locale);
  const hasSymbols = accounts.some(account => account.holdings.some(holding => holding.symbol));

  return (
    <Box sx={card}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography
            variant="overline"
            sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.6 }}
          >
            {t.investmentsTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t.investmentsHint}
          </Typography>
        </Box>
        {hasSymbols && (
          <Button size="small" variant="outlined" disabled={saving} onClick={() => refreshPrices()}>
            {t.refreshPrices}
          </Button>
        )}
      </Box>

      {accounts.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t.noAccounts}
        </Typography>
      )}

      {accounts.map(account => (
        <Box key={account.id} sx={{ mt: 3 }} data-testid={`investment-account-${account.id}`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ flex: 1 }}>
              {account.name}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {account.kind === 'retirement' ? t.kindRetirement : t.kindInvestment}
              </Typography>
            </Typography>
            <Typography variant="body2">
              {t.value}: <strong>{money(account.value)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t.contributed}: {money(account.contributed)}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: account.gain >= 0 ? 'success.main' : 'error.main' }}
            >
              {t.gain}: {account.gain >= 0 ? '+' : '−'}
              {money(Math.abs(account.gain))}
            </Typography>
            <IconButton
              size="small"
              aria-label={`${t.delete.value} ${account.name}`}
              disabled={saving}
              onClick={() => deleteAccount(account.id)}
            >
              <Trash2 size={16} />
            </IconButton>
          </Box>

          {account.holdings.length > 0 && (
            <Box
              component="table"
              sx={{
                width: '100%',
                borderCollapse: 'collapse',
                mt: 1,
                '& th': { textAlign: 'left', py: 0.5, color: 'text.secondary', fontSize: 12 },
                '& td': { py: 0.75, borderTop: 1, borderColor: 'divider', fontSize: 14 },
              }}
            >
              <thead>
                <tr>
                  <th>{t.holdingName}</th>
                  <th>{t.assetClass}</th>
                  <th>{t.quantity}</th>
                  <th>{t.price}</th>
                  <th>{t.value}</th>
                  <th aria-label={t.delete.value} />
                </tr>
              </thead>
              <tbody>
                {account.holdings.map(holding => (
                  <tr key={holding.id}>
                    <td>
                      {holding.name}
                      {holding.symbol && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}
                          {holding.symbol}
                        </Typography>
                      )}
                    </td>
                    <td>{t[ASSET_CLASS_KEYS[holding.assetClass] as 'classStock']}</td>
                    <td>{holding.quantity}</td>
                    <td>
                      {holding.price} {holding.priceCurrency}
                      {holding.priceSource === 'manual' && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}
                          · {t.manualPrice}
                        </Typography>
                      )}
                    </td>
                    <td>{money(holding.value)}</td>
                    <td>
                      <IconButton
                        size="small"
                        aria-label={`${t.delete.value} ${holding.name}`}
                        disabled={saving}
                        onClick={() => deleteHolding(holding.id)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Box>
          )}

          <AddHoldingRow
            account={account}
            saving={saving}
            onAdd={input => addHolding(account.id, input)}
          />
        </Box>
      ))}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 3 }}>
        <TextField
          size="small"
          label={t.accountName.value}
          value={newName}
          onChange={event => setNewName(event.target.value)}
          sx={{ width: 220 }}
        />
        <Select
          size="small"
          value={newKind}
          onChange={event => setNewKind(event.target.value as 'investment' | 'retirement')}
          inputProps={{ 'aria-label': t.assetClass.value }}
        >
          <MenuItem value="investment">{t.kindInvestment}</MenuItem>
          <MenuItem value="retirement">{t.kindRetirement}</MenuItem>
        </Select>
        <Button
          size="small"
          variant="contained"
          disabled={!newName.trim() || saving}
          onClick={async () => {
            await createAccount(newName.trim(), newKind);
            setNewName('');
          }}
        >
          {t.addAccount}
        </Button>
      </Box>
    </Box>
  );
}
