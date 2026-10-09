'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMemo, useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { Trash2 } from '@/app/components/icons';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import { tokens } from '@/lib/theme-tokens';
import {
  type LotDetailsInput,
  METALS,
  type Metal,
  type MetalLot,
  type MetalLotInput,
  type MetalTotals,
  useMetals,
  WEIGHT_UNITS,
  type WeightUnit,
} from '../hooks/useMetals';
import { LotDetailsDialog } from './LotDetailsDialog';
import { SellLotDialog } from './SellLotDialog';

/** Dictionary key per metal; the codes are ISO 4217, the names are not. */
export const METAL_KEYS: Record<Metal, string> = {
  XAU: 'metalGold',
  XAG: 'metalSilver',
  XPT: 'metalPlatinum',
  XPD: 'metalPalladium',
};

/** Germany is the only jurisdiction whose holding period this card states. */
const HOLDING_PERIOD_JURISDICTIONS = ['DE'];

type SortKey = 'newest' | 'roiHigh' | 'roiLow';

const card = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: tokens.radius.md,
  bgcolor: 'background.paper',
  p: 3,
} as const;

const table = {
  width: '100%',
  borderCollapse: 'collapse',
  '& th': {
    textAlign: 'left',
    py: 0.5,
    pr: 2,
    color: 'text.secondary',
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
  '& td': {
    py: 0.75,
    pr: 2,
    borderTop: 1,
    borderColor: 'divider',
    fontSize: 14,
    whiteSpace: 'nowrap',
  },
} as const;

interface MetalsCardProps {
  currency: string;
  locale: string;
}

function formatOunces(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value)} ozt`;
}

function AddLotForm({
  currency,
  saving,
  onAdd,
}: {
  currency: string;
  saving: boolean;
  onAdd: (input: MetalLotInput) => Promise<unknown>;
}) {
  const t = useIntlayer('netWorthPage');
  const [metal, setMetal] = useState<Metal>('XAU');
  const [name, setName] = useState('');
  const [pieces, setPieces] = useState('1');
  const [unitWeight, setUnitWeight] = useState('');
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('ozt');
  const [purity, setPurity] = useState('');
  const [paid, setPaid] = useState('');
  const [acquiredOn, setAcquiredOn] = useState('');
  const [dealer, setDealer] = useState('');

  // A fineness is a fraction: 999 would value the lot a thousand times over.
  const purityValue = purity.trim() ? Number(purity) : null;
  const purityInvalid = purityValue !== null && !(purityValue > 0 && purityValue <= 1);
  const canSave = Number(pieces) > 0 && Number(unitWeight) > 0 && !purityInvalid && !saving;

  const submit = async () => {
    await onAdd({
      metal,
      name: name.trim() || undefined,
      quantity: Number(pieces),
      unitWeight: Number(unitWeight),
      weightUnit,
      purity: purityValue ?? undefined,
      costTotal: paid.trim() ? Number(paid) : undefined,
      costCurrency: paid.trim() ? currency : undefined,
      acquiredOn: acquiredOn || undefined,
      counterparty: dealer.trim() || undefined,
    });
    setName('');
    setPieces('1');
    setUnitWeight('');
    setPurity('');
    setPaid('');
    setAcquiredOn('');
    setDealer('');
  };

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start', mt: 2 }}>
      <Select
        size="small"
        value={metal}
        onChange={value => setMetal(value as Metal)}
        inputProps={{ 'aria-label': t.metal.value }}
        options={METALS.map(item => ({
          value: item,
          label: t[METAL_KEYS[item] as 'metalGold'].value,
        }))}
        sx={{ minWidth: 130 }}
      />
      <TextField
        size="small"
        label={t.holdingName.value}
        value={name}
        onChange={event => setName(event.target.value)}
        sx={{ width: 160 }}
      />
      <TextField
        size="small"
        label={t.quantity.value}
        value={pieces}
        onChange={event => setPieces(event.target.value)}
        inputProps={{ inputMode: 'decimal' }}
        sx={{ width: 90 }}
      />
      <TextField
        size="small"
        label={t.unitWeight.value}
        value={unitWeight}
        onChange={event => setUnitWeight(event.target.value)}
        inputProps={{ inputMode: 'decimal' }}
        sx={{ width: 140 }}
      />
      <Select
        size="small"
        value={weightUnit}
        onChange={value => setWeightUnit(value as WeightUnit)}
        inputProps={{ 'aria-label': t.weightUnit.value }}
        options={WEIGHT_UNITS.map(unit => ({ value: unit, label: unit }))}
        sx={{ minWidth: 80 }}
      />
      <TextField
        size="small"
        label={t.purity.value}
        value={purity}
        onChange={event => setPurity(event.target.value)}
        error={purityInvalid}
        placeholder="0.999"
        inputProps={{ inputMode: 'decimal' }}
        sx={{ width: 100 }}
      />
      <TextField
        size="small"
        label={`${t.paid.value} (${currency})`}
        value={paid}
        onChange={event => setPaid(event.target.value)}
        inputProps={{ inputMode: 'decimal' }}
        sx={{ width: 120 }}
      />
      <Box sx={{ width: 150 }}>
        <CustomDatePicker label={t.acquiredAt.value} value={acquiredOn} onChange={setAcquiredOn} />
      </Box>
      <TextField
        size="small"
        label={t.dealer.value}
        value={dealer}
        onChange={event => setDealer(event.target.value)}
        sx={{ width: 140 }}
      />
      <Button size="small" variant="outlined" disabled={!canSave} onClick={submit}>
        {t.addLot}
      </Button>
    </Box>
  );
}

/** One metal's totals, with the discount that decides what a sale would bring. */
function MetalTotalsRow({
  totals,
  currency,
  locale,
  saving,
  showSilverVat,
  onDiscount,
}: {
  totals: MetalTotals;
  currency: string;
  locale: string;
  saving: boolean;
  showSilverVat: boolean;
  onDiscount: (metal: Metal, percent: number) => void;
}) {
  const t = useIntlayer('netWorthPage');
  const [discount, setDiscount] = useState(String(totals.dealerDiscount));
  const money = (value: number) => formatMoney(value, currency, locale);

  return (
    <Box sx={{ mt: 2 }} data-testid={`metal-total-${totals.metal}`}>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="subtitle1" fontWeight={600}>
          {t[METAL_KEYS[totals.metal] as 'metalGold']}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {formatOunces(totals.fineOunces, locale)}
        </Typography>
        <Typography variant="body2">
          <strong>{money(totals.value)}</strong>
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: totals.gain >= 0 ? 'success.main' : 'error.main' }}
        >
          {totals.gain >= 0 ? '+' : '−'}
          {money(Math.abs(totals.gain))}
        </Typography>
        {totals.costPerOunce !== null && (
          <Typography variant="body2" color="text.secondary">
            {t.costPerOunce}: {money(totals.costPerOunce)}
          </Typography>
        )}
        {totals.realized !== 0 && (
          <Typography
            variant="body2"
            sx={{ color: totals.realized >= 0 ? 'success.main' : 'error.main' }}
          >
            {t.realized}: {totals.realized >= 0 ? '+' : '−'}
            {money(Math.abs(totals.realized))}
          </Typography>
        )}
        <TextField
          size="small"
          label={t.dealerDiscount.value}
          value={discount}
          onChange={event => setDiscount(event.target.value)}
          onBlur={() => {
            const percent = Number(discount);
            if (Number.isFinite(percent) && percent !== totals.dealerDiscount) {
              onDiscount(totals.metal, Math.min(Math.max(percent, 0), 90));
            }
          }}
          disabled={saving}
          inputProps={{ inputMode: 'decimal' }}
          sx={{ width: 150 }}
        />
        {totals.pricedAt && (
          <Typography variant="caption" color="text.secondary">
            {t.priceFrom.value.replace('{{date}}', String(totals.pricedAt).slice(0, 10))}
          </Typography>
        )}
      </Box>
      {showSilverVat && totals.metal === 'XAG' && (
        <Typography variant="caption" color="text.secondary">
          {t.silverVatNote}
        </Typography>
      )}
    </Box>
  );
}

/**
 * Physical gold, silver, platinum and palladium. A lot is entered as pieces,
 * weight and fineness; the card shows the fine weight the spot price applies
 * to, what the metal cost per ounce, and what a dealer would actually pay for
 * it — the number a decision to sell is made against.
 */
export function MetalsCard({ currency, locale }: MetalsCardProps) {
  const t = useIntlayer('netWorthPage');
  const {
    summary,
    saving,
    addLot,
    deleteLot,
    updateLot,
    uploadPhoto,
    removePhoto,
    sellLot,
    setDealerDiscount,
    refreshPrices,
  } = useMetals();
  const [sort, setSort] = useState<SortKey>('newest');
  const [selling, setSelling] = useState<MetalLot | null>(null);
  const [viewing, setViewing] = useState<MetalLot | null>(null);
  const money = (value: number) => formatMoney(value, currency, locale);
  const lots = summary?.lots ?? [];
  const sales = summary?.sales ?? [];
  const showHoldingPeriod = HOLDING_PERIOD_JURISDICTIONS.includes(summary?.jurisdiction ?? '');

  const sorted = useMemo(() => {
    if (sort === 'newest') return lots;
    // A lot with no cost has no ROI; those sink to the bottom either way.
    const rank = (lot: MetalLot) => lot.roi ?? Number.NEGATIVE_INFINITY;
    return [...lots].sort((a, b) => (sort === 'roiHigh' ? rank(b) - rank(a) : rank(a) - rank(b)));
  }, [lots, sort]);

  return (
    <Box sx={card} data-testid="metals-card">
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
            {t.metalsTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t.metalsHint}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          {lots.length > 1 && (
            <Select
              size="small"
              value={sort}
              onChange={value => setSort(value as SortKey)}
              inputProps={{ 'aria-label': t.sortBy.value }}
              options={[
                { value: 'newest', label: t.sortNewest.value },
                { value: 'roiHigh', label: t.sortRoiHigh.value },
                { value: 'roiLow', label: t.sortRoiLow.value },
              ]}
              sx={{ minWidth: 150 }}
            />
          )}
          {lots.length > 0 && (
            <Button
              size="small"
              variant="outlined"
              disabled={saving}
              onClick={() => refreshPrices()}
            >
              {t.refreshPrices}
            </Button>
          )}
        </Box>
      </Box>

      {lots.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t.noLots}
        </Typography>
      )}

      {(summary?.byMetal ?? []).map(totals => (
        <MetalTotalsRow
          key={totals.metal}
          totals={totals}
          currency={currency}
          locale={locale}
          saving={saving}
          showSilverVat={showHoldingPeriod}
          onDiscount={setDealerDiscount}
        />
      ))}

      {lots.length > 0 && (
        <Box sx={{ overflowX: 'auto', mt: 1 }}>
          <Box component="table" sx={table}>
            <thead>
              <tr>
                <th>{t.holdingName}</th>
                <th>{t.fineWeight}</th>
                <th>{t.costPerOunce}</th>
                <th>{t.paid}</th>
                <th>{t.premium}</th>
                <th>{t.value}</th>
                <th>{t.dealerValue}</th>
                <th>{t.roi}</th>
                <th>{t.gain}</th>
                <th aria-label={t.sell.value} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(lot => (
                <tr key={lot.id}>
                  <td>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      {lot.photoUrl && (
                        <Box
                          component="img"
                          src={lot.photoUrl}
                          alt=""
                          sx={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 0.5 }}
                        />
                      )}
                      <Box
                        component="button"
                        type="button"
                        onClick={() => setViewing(lot)}
                        sx={{
                          background: 'none',
                          border: 0,
                          p: 0,
                          font: 'inherit',
                          color: 'inherit',
                          cursor: 'pointer',
                          textAlign: 'left',
                          textDecoration: 'underline',
                          textDecorationStyle: 'dotted',
                        }}
                      >
                        {lot.name}
                      </Box>
                    </Box>
                    <Typography component="span" variant="caption" color="text.secondary">
                      {' '}
                      {t[METAL_KEYS[lot.metal] as 'metalGold'].value} · {lot.quantity} ×{' '}
                      {lot.unitWeight} {lot.weightUnit}
                      {lot.purity < 1 ? ` · ${lot.purity}` : ''}
                      {lot.acquiredOn ? ` · ${lot.acquiredOn}` : ''}
                      {lot.storageLocation ? ` · ${lot.storageLocation}` : ''}
                    </Typography>
                    {showHoldingPeriod && lot.taxFreeFrom && (
                      <Typography
                        component="div"
                        variant="caption"
                        color="text.secondary"
                        data-testid={`tax-free-${lot.id}`}
                      >
                        {t.taxFreeFrom.value.replace('{{date}}', lot.taxFreeFrom)}
                      </Typography>
                    )}
                  </td>
                  <td>{formatOunces(lot.fineOunces, locale)}</td>
                  <td>{lot.costPerOunce === null ? '—' : money(lot.costPerOunce)}</td>
                  <td>{lot.cost === null ? '—' : money(lot.cost)}</td>
                  <td>
                    {lot.premium === null
                      ? '—'
                      : `${lot.premium >= 0 ? '+' : '−'}${money(Math.abs(lot.premium))}${
                          lot.premiumPercent === null ? '' : ` (${lot.premiumPercent}%)`
                        }`}
                  </td>
                  <td>{money(lot.value)}</td>
                  <td>{money(lot.dealerValue)}</td>
                  <td>
                    {lot.roi === null ? (
                      '—'
                    ) : (
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ color: lot.roi >= 0 ? 'success.main' : 'error.main' }}
                      >
                        {lot.roi >= 0 ? '+' : '−'}
                        {Math.abs(lot.roi)}%
                      </Typography>
                    )}
                  </td>
                  <td>
                    {lot.gain === null ? (
                      '—'
                    ) : (
                      <Typography
                        component="span"
                        variant="body2"
                        sx={{ color: lot.gain >= 0 ? 'success.main' : 'error.main' }}
                      >
                        {lot.gain >= 0 ? '+' : '−'}
                        {money(Math.abs(lot.gain))}
                      </Typography>
                    )}
                  </td>
                  <td>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <Button
                        size="small"
                        variant="text"
                        disabled={saving}
                        onClick={() => setSelling(lot)}
                      >
                        {t.sell}
                      </Button>
                      <IconButton
                        size="small"
                        aria-label={`${t.delete.value} ${lot.name}`}
                        disabled={saving}
                        onClick={() => deleteLot(lot.id)}
                      >
                        <Trash2 size={14} />
                      </IconButton>
                    </Box>
                  </td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      )}

      <AddLotForm currency={currency} saving={saving} onAdd={addLot} />

      {sales.length > 0 && (
        <Box sx={{ mt: 3 }} data-testid="metal-sales">
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <Typography
              variant="overline"
              sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.6 }}
            >
              {t.salesTitle}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: (summary?.realized ?? 0) >= 0 ? 'success.main' : 'error.main' }}
            >
              {t.realized}: {(summary?.realized ?? 0) >= 0 ? '+' : '−'}
              {money(Math.abs(summary?.realized ?? 0))}
            </Typography>
          </Box>
          <Box sx={{ overflowX: 'auto' }}>
            <Box component="table" sx={table}>
              <thead>
                <tr>
                  <th>{t.holdingName}</th>
                  <th>{t.soldOn}</th>
                  <th>{t.fineWeight}</th>
                  <th>{t.proceeds}</th>
                  <th>{t.paid}</th>
                  <th>{t.realized}</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => (
                  <tr key={sale.id}>
                    <td>
                      {sale.lotName}
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}
                        {t[METAL_KEYS[sale.metal] as 'metalGold'].value} · {sale.quantity}
                        {sale.counterparty ? ` · ${sale.counterparty}` : ''}
                      </Typography>
                    </td>
                    <td>{sale.soldOn}</td>
                    <td>{formatOunces(sale.fineOunces, locale)}</td>
                    <td>{money(sale.proceeds)}</td>
                    <td>{sale.costBasis === null ? '—' : money(sale.costBasis)}</td>
                    <td>
                      {sale.realized === null ? (
                        '—'
                      ) : (
                        <Typography
                          component="span"
                          variant="body2"
                          sx={{ color: sale.realized >= 0 ? 'success.main' : 'error.main' }}
                        >
                          {sale.realized >= 0 ? '+' : '−'}
                          {money(Math.abs(sale.realized))}
                        </Typography>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Box>
        </Box>
      )}

      <LotDetailsDialog
        lot={viewing}
        currency={currency}
        locale={locale}
        saving={saving}
        onClose={() => setViewing(null)}
        onSave={async (lot, input: LotDetailsInput) => {
          await updateLot(lot.id, input);
          setViewing(null);
        }}
        onUploadPhoto={async (lot, file) => {
          await uploadPhoto(lot.id, file);
          setViewing(null);
        }}
        onRemovePhoto={async lot => {
          await removePhoto(lot.id);
          setViewing(null);
        }}
      />

      <SellLotDialog
        lot={selling}
        currency={currency}
        locale={locale}
        saving={saving}
        onClose={() => setSelling(null)}
        onConfirm={async (lot, input) => {
          await sellLot(lot.id, input);
          setSelling(null);
        }}
      />
    </Box>
  );
}
