'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { Plus, Trash2 } from '@/app/components/icons';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { PRIVATE_CLASS, PrivateAmount } from '@/app/components/ui/private-amount';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import {
  ASSET_CLASSES,
  type InvestmentAccount,
  type InvestmentAssetClass,
  useInvestments,
} from '../hooks/useInvestments';
import { CardTitle, cardSx } from './net-worth-ui';

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
  /** Drawn inside the Holdings section, which supplies the frame and the title. */
  embedded?: boolean;
}

/** A new account: a name and its kind, in a dialog rather than a form on the page. */
function AddAccountDialog({
  open,
  saving,
  onClose,
  onCreate,
}: {
  open: boolean;
  saving: boolean;
  onClose: () => void;
  onCreate: (name: string, kind: 'investment' | 'retirement') => Promise<unknown>;
}) {
  const t = useIntlayer('netWorthPage');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'investment' | 'retirement'>('investment');
  if (!open) {
    return null;
  }
  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={t.addAccount.value}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={async () => {
            await onCreate(name.trim(), kind);
            setName('');
            onClose();
          }}
          confirmText={t.addAccount.value}
          isConfirmLoading={saving}
          isConfirmDisabled={!name.trim() || saving}
        />
      }
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, pt: 1 }}>
        <TextField
          size="small"
          label={t.accountName.value}
          value={name}
          onChange={event => setName(event.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          select
          size="small"
          label={t.assetClass.value}
          value={kind}
          onChange={event => setKind(event.target.value as 'investment' | 'retirement')}
          slotProps={{ inputLabel: { shrink: true } }}
        >
          <MenuItem value="investment">{t.kindInvestment}</MenuItem>
          <MenuItem value="retirement">{t.kindRetirement}</MenuItem>
        </TextField>
      </Box>
    </ModalShell>
  );
}

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
        sx={{ width: 100 }}
        slotProps={{
          htmlInput: { inputMode: 'decimal' },
        }}
      />
      <TextField
        size="small"
        label={`${t.price.value} (${account.currency})`}
        value={price}
        onChange={event => setPrice(event.target.value)}
        sx={{ width: 130 }}
        slotProps={{
          htmlInput: { inputMode: 'decimal' },
        }}
      />
      <Button size="small" variant="outlined" disabled={!canSave || saving} onClick={submit}>
        {t.addHolding}
      </Button>
    </Box>
  );
}

/** Investment and retirement accounts with their holdings, right under the net worth they feed. */
export function InvestmentsCard({ currency, locale, embedded = false }: InvestmentsCardProps) {
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
  const [adding, setAdding] = useState(false);
  const money = (value: number) => formatMoney(value, currency, locale);
  const hasSymbols = accounts.some(account => account.holdings.some(holding => holding.symbol));

  return (
    <Box sx={embedded ? undefined : cardSx}>
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
          {/* Inside Holdings the section header already names it. */}
          {embedded ? null : <CardTitle>{t.investmentsTitle}</CardTitle>}
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              mt: embedded ? 0 : 0.5,
            }}
          >
            {t.investmentsHint}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {hasSymbols && (
            <Button
              size="small"
              variant="outlined"
              disabled={saving}
              onClick={() => refreshPrices()}
            >
              {t.refreshPrices}
            </Button>
          )}
          {accounts.length > 0 && (
            <Button size="small" variant="text" onClick={() => setAdding(true)}>
              <Plus size={16} aria-hidden />
              {t.addAccount}
            </Button>
          )}
        </Box>
      </Box>

      {/* Nothing yet: one quiet line and a way to add, no form on the page. */}
      {accounts.length === 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
            }}
          >
            {t.noAccounts}
          </Typography>
          <Button size="small" variant="text" onClick={() => setAdding(true)}>
            <Plus size={16} aria-hidden />
            {t.addAccount}
          </Button>
        </Box>
      )}

      {accounts.map(account => (
        <Box key={account.id} sx={{ mt: 3 }} data-testid={`investment-account-${account.id}`}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                flex: 1,
              }}
            >
              {account.name}
              <Typography
                component="span"
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  ml: 1,
                }}
              >
                {account.kind === 'retirement' ? t.kindRetirement : t.kindInvestment}
              </Typography>
            </Typography>
            <Typography variant="body2">
              {t.value}: <strong className={PRIVATE_CLASS}>{money(account.value)}</strong>
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: 'text.secondary',
              }}
            >
              {t.contributed}: <PrivateAmount>{money(account.contributed)}</PrivateAmount>
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: account.gain >= 0 ? 'success.main' : 'error.main' }}
            >
              {t.gain}:{' '}
              <PrivateAmount>
                {account.gain >= 0 ? '+' : '−'}
                {money(Math.abs(account.gain))}
              </PrivateAmount>
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
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                          }}
                        >
                          {' '}
                          {holding.symbol}
                        </Typography>
                      )}
                    </td>
                    <td>{t[ASSET_CLASS_KEYS[holding.assetClass] as 'classStock']}</td>
                    <td>{holding.quantity}</td>
                    <td>
                      <PrivateAmount>{holding.price}</PrivateAmount> {holding.priceCurrency}
                      {holding.priceSource === 'manual' && (
                        <Typography
                          component="span"
                          variant="caption"
                          sx={{
                            color: 'text.secondary',
                          }}
                        >
                          {' '}
                          · {t.manualPrice}
                        </Typography>
                      )}
                    </td>
                    <td className={PRIVATE_CLASS}>{money(holding.value)}</td>
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

      <AddAccountDialog
        open={adding}
        saving={saving}
        onClose={() => setAdding(false)}
        onCreate={createAccount}
      />
    </Box>
  );
}
