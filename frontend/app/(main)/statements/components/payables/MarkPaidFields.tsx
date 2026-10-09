'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CustomDatePicker from '@/app/components/CustomDatePicker';
import { Trash2 } from '@/app/components/icons';
import type { Category } from '@/app/components/transactions/types';
import { Select } from '@/app/components/ui/select';
import { useIntlayer } from '@/app/i18n';
import { formatMoney } from '@/app/lib/format-money';
import type { PayablePayment, PaymentCandidate } from '@/app/lib/payables-api';

export type WalletOption = { id: string; name: string; currency: string; isActive?: boolean };

export const today = (): string => new Date().toISOString().slice(0, 10);

/** The transactions that may have settled the bill, one to pick. */
export function CandidateList(props: {
  candidates: PaymentCandidate[];
  loading: boolean;
  selected: string | null;
  onSelect: (id: string) => void;
  locale: string;
}): React.JSX.Element {
  const t = useIntlayer('payableMarkPaid');
  if (props.loading) {
    return <Typography variant="body2">{t.loading.value}</Typography>;
  }
  if (props.candidates.length === 0) {
    return <Alert severity="info">{t.noCandidates.value}</Alert>;
  }
  return (
    <Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
        {t.matchHint.value}
      </Typography>
      <RadioGroup
        value={props.selected ?? ''}
        onChange={event => props.onSelect(event.target.value)}
      >
        {props.candidates.map(candidate => (
          <FormControlLabel
            key={candidate.id}
            value={candidate.id}
            control={<Radio size="small" />}
            // The label is a block of its own; the default <p> wrapper cannot hold it.
            disableTypography
            sx={{ alignItems: 'flex-start', mb: 1, minWidth: 0 }}
            label={<CandidateLabel candidate={candidate} locale={props.locale} />}
          />
        ))}
      </RadioGroup>
    </Box>
  );
}

function CandidateLabel(props: { candidate: PaymentCandidate; locale: string }): React.JSX.Element {
  const t = useIntlayer('payableMarkPaid');
  const { candidate } = props;
  return (
    <Box sx={{ minWidth: 0 }}>
      {/* A div, not a p: the chip inside it renders a div. */}
      <Typography
        component="div"
        variant="body2"
        fontWeight={600}
        sx={{ overflowWrap: 'anywhere' }}
      >
        {candidate.transactionDate} ·{' '}
        {formatMoney(Number(candidate.amount), candidate.currency, props.locale)}
        {candidate.vendorMatch && <Chip size="small" label={t.vendorMatch.value} sx={{ ml: 1 }} />}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', overflowWrap: 'anywhere' }}>
        {candidate.counterpartyName} — {candidate.paymentPurpose}
      </Typography>
    </Box>
  );
}

export type CashState = { walletId: string | null; paidOn: string; categoryId: string };

/** Where and when a cash payment was made; the server records it as a transaction. */
export function CashFields(props: {
  currency: string;
  wallets: WalletOption[];
  walletsLoading: boolean;
  categories: Category[];
  value: CashState;
  onChange: (next: CashState) => void;
}): React.JSX.Element {
  const t = useIntlayer('payableMarkPaid');
  const { value, onChange } = props;
  const noWallet = props.wallets.length === 0 && !props.walletsLoading;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {noWallet ? (
        <Alert severity="info">{t.noWallets.value.replace('{currency}', props.currency)}</Alert>
      ) : (
        <Box>
          <Typography
            component="label"
            id="mark-paid-wallet-label"
            htmlFor="mark-paid-wallet"
            variant="caption"
          >
            {t.wallet.value}
          </Typography>
          <Select
            id="mark-paid-wallet"
            labelId="mark-paid-wallet-label"
            value={value.walletId ?? ''}
            options={props.wallets.map(wallet => ({ value: wallet.id, label: wallet.name }))}
            onChange={walletId => onChange({ ...value, walletId })}
          />
        </Box>
      )}
      <Box>
        <Typography component="label" htmlFor="mark-paid-date" variant="caption">
          {t.paidOn.value}
        </Typography>
        <CustomDatePicker
          id="mark-paid-date"
          large
          value={value.paidOn}
          maxDate={today()}
          onChange={paidOn => onChange({ ...value, paidOn })}
        />
      </Box>
      <Box>
        <Typography
          component="label"
          id="mark-paid-category-label"
          htmlFor="mark-paid-category"
          variant="caption"
        >
          {t.category.value}
        </Typography>
        <Select
          id="mark-paid-category"
          labelId="mark-paid-category-label"
          value={value.categoryId}
          options={[
            { value: '', label: t.noCategory.value },
            ...props.categories.map(category => ({ value: category.id, label: category.name })),
          ]}
          onChange={categoryId => onChange({ ...value, categoryId })}
        />
      </Box>
      <Alert severity="info">{t.cashHint.value}</Alert>
    </Box>
  );
}

export type AmountState = { amount: string; feeAmount: string };

/**
 * How much of the bill this payment settles.
 *
 * Pre-filled with everything still outstanding — the common case is paying the
 * rest — but a smaller number is the whole point: the client who sent 400 of
 * 1000 has paid 400, not nothing.
 */
export function AmountFields(props: {
  currency: string;
  locale: string;
  paidSoFar: number;
  outstanding: number;
  value: AmountState;
  onChange: (next: AmountState) => void;
}): React.JSX.Element {
  const t = useIntlayer('payableMarkPaid');
  const { value, onChange } = props;
  const amount = Number(value.amount);
  const tooMuch = Number.isFinite(amount) && amount > props.outstanding + 0.005;
  const partial = Number.isFinite(amount) && amount > 0 && amount < props.outstanding - 0.005;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {props.paidSoFar > 0 && (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {t.paidSoFar.value} {formatMoney(props.paidSoFar, props.currency, props.locale)} ·{' '}
          {t.outstanding.value} {formatMoney(props.outstanding, props.currency, props.locale)}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          type="number"
          label={String(t.amount.value)}
          value={value.amount}
          error={tooMuch}
          helperText={tooMuch ? String(t.amountTooMuch.value) : undefined}
          onChange={event => onChange({ ...value, amount: event.target.value })}
          inputProps={{ min: 0, step: 0.01, 'aria-label': String(t.amount.value) }}
          sx={{ flex: '1 1 140px' }}
        />
        <TextField
          size="small"
          type="number"
          label={String(t.feeAmount.value)}
          value={value.feeAmount}
          onChange={event => onChange({ ...value, feeAmount: event.target.value })}
          inputProps={{ min: 0, step: 0.01, 'aria-label': String(t.feeAmount.value) }}
          sx={{ flex: '1 1 140px' }}
        />
      </Box>
      {Number(value.feeAmount) > 0 && <Alert severity="info">{t.feeHint.value}</Alert>}
      {partial && <Alert severity="info">{t.partialHint.value}</Alert>}
    </Box>
  );
}

/** What has already been paid against the bill, newest first. */
export function PaymentLog(props: {
  payments: PayablePayment[];
  currency: string;
  locale: string;
  removingId: string | null;
  onRemove: (paymentId: string) => void;
}): React.JSX.Element | null {
  const t = useIntlayer('payableMarkPaid');
  if (props.payments.length === 0) {
    return null;
  }
  return (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
        {t.paymentsTitle.value}
      </Typography>
      {props.payments.map(payment => (
        <Box
          key={payment.id}
          sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between' }}
        >
          <Typography variant="body2" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
            {payment.paidOn} · {formatMoney(Number(payment.amount), props.currency, props.locale)}
            {Number(payment.feeAmount) > 0 && (
              <Typography component="span" variant="caption" sx={{ color: 'text.secondary' }}>
                {' '}
                ({String(t.feeAmount.value)}{' '}
                {formatMoney(Number(payment.feeAmount), props.currency, props.locale)})
              </Typography>
            )}
          </Typography>
          <IconButton
            size="small"
            aria-label={String(t.removePayment.value)}
            disabled={props.removingId === payment.id}
            onClick={() => props.onRemove(payment.id)}
          >
            <Trash2 size={16} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
}
