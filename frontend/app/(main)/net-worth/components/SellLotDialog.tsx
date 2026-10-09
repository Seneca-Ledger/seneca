'use client';

import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useEffect, useState } from 'react';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { ModalFooter, ModalShell } from '@/app/components/ui/modal-shell';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { MetalLot, SellLotInput } from '../hooks/useMetals';

interface SellLotDialogProps {
  /** The lot being sold; the dialog is closed while null. */
  lot: MetalLot | null;
  currency: string;
  locale: string;
  saving: boolean;
  onClose: () => void;
  onConfirm: (lot: MetalLot, input: SellLotInput) => void;
}

/**
 * Selling a lot, whole or in part. The proceeds start at what a dealer would
 * pay for the pieces being sold, because that is the number people are deciding
 * against; leaving zero records a gift.
 */
export function SellLotDialog({
  lot,
  currency,
  locale,
  saving,
  onClose,
  onConfirm,
}: SellLotDialogProps) {
  const t = useIntlayer('netWorthPage');
  const [pieces, setPieces] = useState('');
  const [proceeds, setProceeds] = useState('');
  const [soldOn, setSoldOn] = useState('');
  const [counterparty, setCounterparty] = useState('');

  useEffect(() => {
    if (!lot) return;
    setPieces(String(lot.quantity));
    setProceeds(String(round2(lot.dealerValue)));
    setSoldOn(new Date().toISOString().slice(0, 10));
    setCounterparty(lot.counterparty ?? '');
  }, [lot]);

  if (!lot) return null;

  const sold = Number(pieces);
  const piecesValid = sold > 0 && sold <= lot.quantity;
  const valid = piecesValid && Number(proceeds) >= 0;
  // Derived figures follow a share of the lot, so a count the lot cannot cover
  // has none: showing the weight and result of five coins out of two would be
  // a confident lie next to a disabled button.
  const share = piecesValid && lot.quantity > 0 ? sold / lot.quantity : null;
  const costBasis = lot.cost === null || share === null ? null : round2(lot.cost * share);
  const realized = costBasis === null ? null : round2(Number(proceeds || 0) - costBasis);

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={`${t.sell.value}: ${lot.name}`}
      size="sm"
      footer={
        <ModalFooter
          onCancel={onClose}
          onConfirm={() =>
            onConfirm(lot, {
              quantity: sold,
              proceeds: Number(proceeds || 0),
              soldOn: soldOn || undefined,
              counterparty: counterparty.trim() || undefined,
            })
          }
          confirmText={t.sell.value}
          isConfirmLoading={saving}
          isConfirmDisabled={!valid || saving}
        />
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label={t.quantity.value}
            value={pieces}
            onChange={event => setPieces(event.target.value)}
            inputProps={{ inputMode: 'decimal' }}
            error={pieces !== '' && !piecesValid}
            helperText={
              share === null
                ? `${t.quantity.value}: 1…${lot.quantity}`
                : `${t.fineWeight.value}: ${formatOunces(lot.fineOunces * share, locale)}`
            }
            sx={{ width: 140 }}
          />
          <TextField
            size="small"
            label={`${t.proceeds.value} (${currency})`}
            value={proceeds}
            onChange={event => setProceeds(event.target.value)}
            inputProps={{ inputMode: 'decimal' }}
            helperText={Number(proceeds) === 0 ? t.gift.value : ' '}
            sx={{ width: 160 }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Box sx={{ width: 160 }}>
            <CustomDatePicker label={t.soldOn.value} value={soldOn} onChange={setSoldOn} />
          </Box>
          <TextField
            size="small"
            label={t.dealer.value}
            value={counterparty}
            onChange={event => setCounterparty(event.target.value)}
            sx={{ width: 180 }}
          />
        </Box>
        {realized !== null && (
          <Typography variant="body2" color="text.secondary">
            {t.realized}:{' '}
            <Typography
              component="span"
              variant="body2"
              sx={{ color: realized >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}
            >
              {realized >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(realized), currency, locale)}
            </Typography>
          </Typography>
        )}
      </Box>
    </ModalShell>
  );
}

function formatOunces(value: number, locale: string): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value)} ozt`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
